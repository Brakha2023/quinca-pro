import type { Transaction } from '@powersync/web';
import type { CaisseRow, TransfertFilialeRow } from '@quinca/shared-types';
import { numeroPiece } from '../../desktop/identitePoste';
import {
  CATEGORIE_RETRAIT, CATEGORIE_TRANSFERT_FILIALE, CATEGORIE_VERSEMENT, normaliserCodeCategorie,
  type CaisseForm, type CategorieForm, type OperationForm, type RetraitForm, type TransfertCaisseForm, type TransfertFilialeForm, type VersementForm,
} from '../../../core/tresorerie';
import { BaseRepository } from './BaseRepository';

export const CAISSES_QUERY = 'SELECT * FROM caisses WHERE filiale_id = ? ORDER BY est_active DESC, nom';

/** Catégories ajoutées par la filiale, désactivées comprises : l'écran de gestion les montre toutes. */
export const CATEGORIES_TRESORERIE_QUERY = 'SELECT * FROM categories_tresorerie WHERE filiale_id = ? ORDER BY type, libelle';

export interface FiltresTresorerie {
  caisseId?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  type?: 'RECETTE' | 'DEPENSE' | null;
  limite?: number;
}

export function mouvementsTresorerieQuery(filialeId: string | null, filtres: FiltresTresorerie = {}) {
  const conditions = ['m.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.caisseId) { conditions.push('m.caisse_id = ?'); params.push(filtres.caisseId); }
  if (filtres.dateDebut) { conditions.push('m.date_operation >= ?'); params.push(new Date(`${filtres.dateDebut}T00:00:00`).toISOString()); }
  if (filtres.dateFin) { conditions.push('m.date_operation <= ?'); params.push(new Date(`${filtres.dateFin}T23:59:59.999`).toISOString()); }
  if (filtres.type) { conditions.push('m.type = ?'); params.push(filtres.type); }
  params.push(filtres.limite ?? 500);
  return {
    sql: `SELECT m.*, c.nom AS caisse_nom, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
          FROM mouvements_tresorerie m JOIN caisses c ON c.id = m.caisse_id LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
          WHERE ${conditions.join(' AND ')} ORDER BY m.date_operation DESC LIMIT ?`,
    params,
  };
}

/**
 * Mouvements depuis un instant donné : sert à remonter au solde d'ouverture,
 * caisse par caisse (`caisse_id`) pour l'état des caisses, ou toutes caisses
 * confondues pour le journal.
 */
export function mouvementsDepuisQuery(filialeId: string | null, caisseId: string | null, debut: string) {
  const conditions = ['filiale_id = ?', 'date_operation >= ?'];
  const params: Array<string | number> = [filialeId ?? '', new Date(`${debut}T00:00:00`).toISOString()];
  if (caisseId) { conditions.push('caisse_id = ?'); params.push(caisseId); }
  return { sql: `SELECT id, caisse_id, type, montant, date_operation FROM mouvements_tresorerie WHERE ${conditions.join(' AND ')}`, params };
}

/** Transferts inter-filiales où la filiale est expéditrice ou destinataire. */
/**
 * Les transferts où la filiale est partie prenante, dans les deux sens.
 *
 * Les jointures de droite servent au **bordereau** : caisse d'arrivée, nom de
 * celui qui a saisi, nom de celui qui a encaissé. Elles rendent souvent nul du
 * côté de l'expéditeur — un poste ne synchronise ni les caisses ni les
 * utilisateurs d'en face — et la pièce s'imprime quand même.
 */
export const TRANSFERTS_FILIALES_QUERY = `
  SELECT t.*, fs.nom AS filiale_source_nom, fd.nom AS filiale_destination_nom,
    c.nom AS caisse_source_nom, cd.nom AS caisse_destination_nom,
    ue.nom AS envoi_nom, ue.prenom AS envoi_prenom,
    ur.nom AS reception_nom, ur.prenom AS reception_prenom
  FROM transferts_filiales t
  LEFT JOIN filiales fs ON fs.id = t.filiale_source_id
  LEFT JOIN filiales fd ON fd.id = t.filiale_destination_id
  LEFT JOIN caisses c ON c.id = t.caisse_source_id
  LEFT JOIN caisses cd ON cd.id = t.caisse_destination_id
  LEFT JOIN utilisateurs ue ON ue.id = t.utilisateur_envoi_id
  LEFT JOIN utilisateurs ur ON ur.id = t.utilisateur_reception_id
  WHERE t.filiale_source_id = ? OR t.filiale_destination_id = ?
  ORDER BY t.date_envoi DESC LIMIT 200`;

export interface ContexteTresorerie {
  filialeId: string;
  utilisateurId: string | null;
}

export class TresorerieRepository extends BaseRepository {
  async createCaisse(filialeId: string, form: CaisseForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO caisses (id, code, nom, filiale_id, responsable, solde_actuel, est_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
      [id, form.code, form.nom, filialeId, form.responsable || null, now, now],
    );
    return id;
  }

  async updateCaisse(id: string, form: CaisseForm): Promise<void> {
    await this.patch(this.db, 'caisses', id, { code: form.code, nom: form.nom, responsable: form.responsable || null });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.patch(this.db, 'caisses', id, { est_active: active ? 1 : 0 });
  }

  async codeExiste(filialeId: string, code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>('SELECT id FROM caisses WHERE filiale_id = ? AND code = ? AND id != ? LIMIT 1', [filialeId, code, excludeId ?? '']);
    return rows.length > 0;
  }

  /**
   * Une catégorie de plus pour cette filiale.
   *
   * Le code est dérivé du libellé **ici**, une fois pour toutes : il part dans
   * `mouvements_tresorerie.categorie` et ne bougera plus. L'unicité est
   * revérifiée dans la transaction — le poste a pu créer la même hors ligne
   * pendant qu'un autre la créait aussi, et c'est un message clair qu'il faut
   * alors, pas un refus du serveur trois minutes plus tard.
   */
  creerCategorie(filialeId: string, form: CategorieForm): Promise<string> {
    const code = normaliserCodeCategorie(form.libelle);
    if (!code) throw new Error('Donnez un nom qui contient au moins une lettre ou un chiffre.');
    return this.db.writeTransaction(async (tx) => {
      const prises = await tx.getAll<{ libelle: string | null }>(
        'SELECT libelle FROM categories_tresorerie WHERE filiale_id = ? AND code = ? LIMIT 1',
        [filialeId, code],
      );
      if (prises.length > 0) throw new Error(`« ${prises[0]?.libelle ?? code} » existe déjà sous ce nom.`);
      const now = this.maintenant();
      await tx.execute(
        'INSERT INTO categories_tresorerie (id, filiale_id, code, libelle, type, est_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)',
        [this.nouvelId(), filialeId, code, form.libelle, form.type, now, now],
      );
      return code;
    });
  }

  /** Le libellé change, le code jamais : les mouvements déjà enregistrés le portent. */
  async renommerCategorie(id: string, libelle: string): Promise<void> {
    await this.patch(this.db, 'categories_tresorerie', id, { libelle });
  }

  /**
   * Retirer une catégorie de la liste de saisie, ou l'y remettre. Jamais de
   * suppression : son code nomme encore les mouvements du passé.
   */
  async activerCategorie(id: string, active: boolean): Promise<void> {
    await this.patch(this.db, 'categories_tresorerie', id, { est_active: active ? 1 : 0 });
  }

  /** Recette ou dépense manuelle : mouvement + solde de caisse. */
  enregistrerOperation(ctx: ContexteTresorerie, op: OperationForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = numeroPiece(op.type === 'RECETTE' ? 'REC' : 'DEP');
      await this.mouvementer(tx, ctx, op.caisse_id, op.type, op.categorie, op.montant, op.description || null, op.reference || numero);
      return numero;
    });
  }

  /** Transfert entre deux caisses : une dépense et une recette portant la même référence. */
  transferer(ctx: ContexteTresorerie, t: TransfertCaisseForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = numeroPiece('TRC');
      const source = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [t.caisse_source_id]);
      const dest = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [t.caisse_destination_id]);
      await this.mouvementer(tx, ctx, t.caisse_source_id, 'DEPENSE', 'TRANSFERT_CAISSE', t.montant, `Vers ${dest.nom ?? ''}${t.motif ? ` — ${t.motif}` : ''}`, numero);
      await this.mouvementer(tx, ctx, t.caisse_destination_id, 'RECETTE', 'TRANSFERT_CAISSE', t.montant, `Depuis ${source.nom ?? ''}${t.motif ? ` — ${t.motif}` : ''}`, numero);
      return numero;
    });
  }

  /**
   * Versement encaissé au guichet : de l'argent qui entre en caisse, au nom de
   * celui qui l'apporte.
   *
   * Il ne touche **aucun compte de tiers**, volontairement. Régler une créance
   * demande de voir les factures du client et de lettrer le règlement : cela se
   * fait dans *Clients → Compte client*, pas au guichet de la trésorerie, où
   * deux saisies pour une même somme passeraient inaperçues.
   */
  enregistrerVersement(ctx: ContexteTresorerie, v: VersementForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = numeroPiece('VER');
      const description = [v.remettant, v.designation].filter(Boolean).join(' — ');
      await this.mouvementer(tx, ctx, v.caisse_id, 'RECETTE', CATEGORIE_VERSEMENT, v.montant, description || null, v.reference || numero);
      return numero;
    });
  }

  /** Retrait d'espèces : sortie de caisse au profit d'un bénéficiaire nommé. */
  enregistrerRetrait(ctx: ContexteTresorerie, r: RetraitForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = numeroPiece('RET');
      const description = [r.beneficiaire, r.motif].filter(Boolean).join(' — ');
      await this.mouvementer(tx, ctx, r.caisse_id, 'DEPENSE', CATEGORIE_RETRAIT, r.montant, description || null, r.reference || numero);
      return numero;
    });
  }

  /**
   * Envoi d'espèces vers une autre filiale : les fonds sortent tout de suite
   * de la caisse source et le transfert part « EN_TRANSIT ». La caisse
   * d'arrivée est choisie par la filiale destinataire à la réception.
   */
  envoyerVersFiliale(ctx: ContexteTresorerie, t: TransfertFilialeForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = numeroPiece('TRF');
      const now = this.maintenant();
      const destination = await tx.get<{ nom: string | null }>('SELECT nom FROM filiales WHERE id = ?', [t.filiale_destination_id]);
      await tx.execute(
        `INSERT INTO transferts_filiales (id, numero, filiale_source_id, filiale_destination_id, caisse_source_id, caisse_destination_id,
           montant, motif, statut, date_envoi, date_reception, utilisateur_envoi_id, utilisateur_reception_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, ?, 'EN_TRANSIT', ?, NULL, ?, NULL, ?, ?)`,
        [this.nouvelId(), numero, ctx.filialeId, t.filiale_destination_id, t.caisse_source_id, t.montant, t.motif || null, now, ctx.utilisateurId, now, now],
      );
      await this.mouvementer(tx, ctx, t.caisse_source_id, 'DEPENSE', CATEGORIE_TRANSFERT_FILIALE, t.montant, `Vers ${destination?.nom ?? 'filiale'}${t.motif ? ` — ${t.motif}` : ''}`, numero);
      return numero;
    });
  }

  /** Réception par la filiale destinataire : les fonds entrent dans la caisse choisie. */
  recevoirTransfert(ctx: ContexteTresorerie, transfertId: string, caisseDestinationId: string): Promise<void> {
    return this.db.writeTransaction(async (tx) => {
      const transfert = await tx.get<TransfertFilialeRow>('SELECT * FROM transferts_filiales WHERE id = ?', [transfertId]);
      if (transfert.statut !== 'EN_TRANSIT') throw new Error('Ce transfert a déjà été traité.');
      if (transfert.filiale_destination_id !== ctx.filialeId) throw new Error('Seule la filiale destinataire peut encaisser ce transfert.');
      const source = await tx.get<{ nom: string | null }>('SELECT nom FROM filiales WHERE id = ?', [transfert.filiale_source_id ?? '']);
      await this.patch(tx, 'transferts_filiales', transfertId, {
        statut: 'RECU', caisse_destination_id: caisseDestinationId, date_reception: this.maintenant(), utilisateur_reception_id: ctx.utilisateurId,
      });
      await this.mouvementer(tx, ctx, caisseDestinationId, 'RECETTE', CATEGORIE_TRANSFERT_FILIALE, transfert.montant ?? 0,
        `Depuis ${source?.nom ?? 'filiale'}${transfert.motif ? ` — ${transfert.motif}` : ''}`, transfert.numero ?? '');
    });
  }

  /** Annulation par l'expéditeur tant que les fonds ne sont pas arrivés : la caisse source est recréditée. */
  annulerTransfert(ctx: ContexteTresorerie, transfertId: string, motif: string): Promise<void> {
    return this.db.writeTransaction(async (tx) => {
      const transfert = await tx.get<TransfertFilialeRow>('SELECT * FROM transferts_filiales WHERE id = ?', [transfertId]);
      if (transfert.statut !== 'EN_TRANSIT') throw new Error('Ce transfert a déjà été traité.');
      if (transfert.filiale_source_id !== ctx.filialeId) throw new Error('Seule la filiale expéditrice peut annuler ce transfert.');
      // Le motif d'origine reste lisible : la raison de l'annulation s'y ajoute.
      await this.patch(tx, 'transferts_filiales', transfertId, {
        statut: 'ANNULE',
        motif: [transfert.motif, motif && `Annulé : ${motif}`].filter(Boolean).join(' — ') || null,
      });
      await this.mouvementer(tx, ctx, transfert.caisse_source_id ?? '', 'RECETTE', CATEGORIE_TRANSFERT_FILIALE, transfert.montant ?? 0,
        `Annulation du transfert ${transfert.numero ?? ''}${motif ? ` — ${motif}` : ''}`, transfert.numero ?? '');
    });
  }

  private async mouvementer(tx: Transaction, ctx: ContexteTresorerie, caisseId: string, type: 'RECETTE' | 'DEPENSE', categorie: string, montant: number, description: string | null, reference: string): Promise<void> {
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), type, categorie, montant, description, reference, caisseId, ctx.utilisateurId, ctx.filialeId, now, now],
    );
    const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [caisseId]);
    await this.patch(tx, 'caisses', caisseId, { solde_actuel: (caisse.solde_actuel ?? 0) + (type === 'RECETTE' ? montant : -montant) });
  }
}
