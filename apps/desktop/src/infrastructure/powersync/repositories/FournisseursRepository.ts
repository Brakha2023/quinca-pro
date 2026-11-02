import type { Transaction } from '@powersync/web';
import type { ArticleRow, CaisseRow, CommandeFournisseurRow, FournisseurRow, LigneCommandeFournisseurRow } from '@quinca/shared-types';
import { TYPES_EN_CAISSE } from '../../../core/clients';
import { genererCodeTiers } from '../../../core/commun/numerotation';
import { numeroPiece } from '../../desktop/identitePoste';
import { arrondirMontant } from '../../../core/commun/prix';
import {
  calculerDette, ligneCommandeFromRow, motifNonSupprimableFournisseur, statutApresReception, totalLigneCommande,
  totauxAchat, totauxCommande, usagesFournisseur, valoriserReception,
  type Achat, type BonCommande, type Fournisseur, type FournisseurForm, type Reception,
  type ReglementFournisseurForm, type UsagesFournisseur,
} from '../../../core/fournisseurs';
import { fusionnerLignes } from '../../../core/stock';
import { usagesFournisseurServeur } from '../../supabase/usagesTiers';
import { BaseRepository } from './BaseRepository';
import { mouvementerDetteFournisseur } from './compteFournisseur';
import { StockRepository } from './StockRepository';

export interface FiltresFournisseurs {
  recherche?: string;
  inclureInactifs?: boolean;
  avecDette?: boolean;
}

export function fournisseursQuery(filialeId: string | null, filtres: FiltresFournisseurs = {}) {
  const conditions = ['filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (!filtres.inclureInactifs) conditions.push('est_actif = 1');
  if (filtres.avecDette) conditions.push('solde_actuel > 0');
  const q = filtres.recherche?.trim();
  if (q) { conditions.push('(code LIKE ? OR numero_compte LIKE ? OR raison_sociale LIKE ? OR telephone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  return { sql: `SELECT * FROM fournisseurs WHERE ${conditions.join(' AND ')} ORDER BY raison_sociale`, params };
}

export const ACHATS_FOURNISSEUR_QUERY = 'SELECT * FROM commandes_fournisseurs WHERE fournisseur_id = ? ORDER BY date_commande DESC';
export const REGLEMENTS_FOURNISSEUR_QUERY = `
  SELECT r.*, c.nom AS caisse_nom FROM reglements_fournisseurs r LEFT JOIN caisses c ON c.id = r.caisse_id
  WHERE r.fournisseur_id = ? ORDER BY r.date_reglement DESC`;
export const LIGNES_COMMANDE_QUERY = 'SELECT * FROM lignes_commande_fournisseur WHERE commande_id = ? ORDER BY created_at';

/** Une pièce fournisseur avec ses noms joints : sert à rééditer sa facture. */
export const COMMANDE_QUERY = `
  SELECT c.*, f.raison_sociale AS fournisseur_nom, d.nom AS depot_nom, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom,
         (SELECT COUNT(*) FROM lignes_commande_fournisseur l WHERE l.commande_id = c.id) AS nombre_lignes
  FROM commandes_fournisseurs c
  JOIN fournisseurs f ON f.id = c.fournisseur_id
  LEFT JOIN depots d ON d.id = c.depot_id
  LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
  WHERE c.id = ?`;

export interface FiltresCommandes {
  fournisseurId?: string | null;
  /** Bons de commande ouverts (envoyés ou partiellement reçus). */
  ouvertesSeulement?: boolean;
  recherche?: string;
  limite?: number;
}

export function commandesQuery(filialeId: string | null, filtres: FiltresCommandes = {}) {
  const conditions = ['c.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.fournisseurId) { conditions.push('c.fournisseur_id = ?'); params.push(filtres.fournisseurId); }
  if (filtres.ouvertesSeulement) conditions.push("c.statut IN ('ENVOYEE', 'PARTIELLE')");
  const q = filtres.recherche?.trim();
  if (q) { conditions.push('(c.numero LIKE ? OR f.raison_sociale LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  params.push(filtres.limite ?? 300);
  return {
    sql: `SELECT c.*, f.raison_sociale AS fournisseur_nom, d.nom AS depot_nom, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom,
                 (SELECT COUNT(*) FROM lignes_commande_fournisseur l WHERE l.commande_id = c.id) AS nombre_lignes
          FROM commandes_fournisseurs c
          JOIN fournisseurs f ON f.id = c.fournisseur_id
          LEFT JOIN depots d ON d.id = c.depot_id
          LEFT JOIN utilisateurs u ON u.id = c.utilisateur_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY c.date_commande DESC LIMIT ?`,
    params,
  };
}

export interface FiltresReglementsFournisseurs {
  fournisseurId?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  limite?: number;
}

/** Historique des règlements de la filiale (tous fournisseurs). */
export function reglementsFournisseursQuery(filialeId: string | null, filtres: FiltresReglementsFournisseurs = {}) {
  const conditions = ['r.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.fournisseurId) { conditions.push('r.fournisseur_id = ?'); params.push(filtres.fournisseurId); }
  if (filtres.dateDebut) { conditions.push('r.date_reglement >= ?'); params.push(new Date(`${filtres.dateDebut}T00:00:00`).toISOString()); }
  if (filtres.dateFin) { conditions.push('r.date_reglement <= ?'); params.push(new Date(`${filtres.dateFin}T23:59:59.999`).toISOString()); }
  params.push(filtres.limite ?? 500);
  return {
    sql: `SELECT r.*, f.raison_sociale AS fournisseur_nom, f.code AS fournisseur_code, c.nom AS caisse_nom, cmd.numero AS commande_numero,
                 u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
          FROM reglements_fournisseurs r
          JOIN fournisseurs f ON f.id = r.fournisseur_id
          LEFT JOIN caisses c ON c.id = r.caisse_id
          LEFT JOIN commandes_fournisseurs cmd ON cmd.id = r.commande_id
          LEFT JOIN utilisateurs u ON u.id = r.utilisateur_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY r.date_reglement DESC LIMIT ?`,
    params,
  };
}

/** Tout ce qui nomme le fournisseur, compté d'un coup dans la base du poste. */
export const USAGES_FOURNISSEUR_QUERY = `
  SELECT (SELECT COUNT(*) FROM commandes_fournisseurs  WHERE fournisseur_id = ?) AS commandes,
         (SELECT COUNT(*) FROM reglements_fournisseurs WHERE fournisseur_id = ?) AS reglements,
         (SELECT COUNT(*) FROM mouvements_stock        WHERE fournisseur_id = ?) AS entrees`;

/** Ce qu'il faut connaître d'un fournisseur pour décider de son effacement. */
export type FournisseurASupprimer = Pick<Fournisseur, 'id' | 'code' | 'raison_sociale' | 'solde_initial' | 'cumul_factures' | 'cumul_reglements'>;

export interface ContexteFournisseur {
  filialeId: string;
  utilisateurId: string | null;
}

export class FournisseursRepository extends BaseRepository {
  async create(filialeId: string, form: FournisseurForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO fournisseurs (id, code, numero_compte, raison_sociale, famille, type_article, telephone, email, adresse, solde_initial,
                                 cumul_factures, cumul_reglements, solde_actuel, plafond_credit, filiale_id, est_actif, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 1, ?, ?)`,
      [id, form.code || genererCodeTiers('FOU'), form.numero_compte || null, form.raison_sociale, form.famille || null, form.type_article || null,
       form.telephone || null, form.email || null, form.adresse || null, form.solde_initial, form.solde_initial, form.plafond_credit, filialeId, now, now],
    );
    await this.patch(this.db, 'fournisseurs', id, this.colonnesComplementaires(form));
    return id;
  }

  async update(id: string, form: FournisseurForm): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const row = await tx.get<FournisseurRow>('SELECT * FROM fournisseurs WHERE id = ?', [id]);
      await this.patch(tx, 'fournisseurs', id, {
        code: form.code || row.code, numero_compte: form.numero_compte || null, raison_sociale: form.raison_sociale, famille: form.famille || null,
        type_article: form.type_article || null, telephone: form.telephone || null, email: form.email || null, adresse: form.adresse || null,
        solde_initial: form.solde_initial, plafond_credit: form.plafond_credit,
        solde_actuel: calculerDette({ solde_initial: form.solde_initial, cumul_factures: row.cumul_factures ?? 0, cumul_reglements: row.cumul_reglements ?? 0 }),
        ...this.colonnesComplementaires(form),
      });
    });
  }

  private colonnesComplementaires(form: FournisseurForm) {
    return {
      mobile: form.mobile || null, numero_rc: form.numero_rc || null, numero_cc: form.numero_cc || null, interlocuteur: form.interlocuteur || null,
      mobile_interlocuteur: form.mobile_interlocuteur || null, date_effet_solde: form.date_effet_solde || null, periode_reglement: form.periode_reglement || null,
      delai_echeance_jours: form.delai_echeance_jours, avance_confirmation_percent: form.avance_confirmation_percent, pourcentage_echeance: form.pourcentage_echeance,
      banque: form.banque || null, numero_compte_bancaire: form.numero_compte_bancaire || null, notes: form.notes || null,
    };
  }

  /**
   * Un fournisseur qui a servi ne se supprime pas : il se désactive. Il quitte
   * les écrans de saisie, son compte et son histoire restent lisibles.
   */
  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'fournisseurs', id, { est_actif: actif ? 1 : 0 });
  }

  /** Ce qui rattache le fournisseur à l'activité, vu depuis la base du poste. */
  async usages(id: string): Promise<UsagesFournisseur> {
    const row = await this.db.get<Partial<UsagesFournisseur>>(USAGES_FOURNISSEUR_QUERY, Array<string>(3).fill(id));
    return usagesFournisseur(row);
  }

  /**
   * Pourquoi ce fournisseur ne peut pas être supprimé — ou `null` s'il peut
   * l'être. Le poste répond tout de suite mais ne garde que douze mois : c'est
   * le serveur qui tranche, et hors ligne on ne supprime pas (voir
   * `ClientsRepository.motifDeRefus`, même règle).
   */
  async motifDeRefus(fournisseur: FournisseurASupprimer): Promise<string | null> {
    const surLePoste = motifNonSupprimableFournisseur(fournisseur, await this.usages(fournisseur.id));
    if (surLePoste) return surLePoste;

    const auServeur = await usagesFournisseurServeur(fournisseur.id);
    if (!auServeur) {
      return `Sans réseau, le poste ne peut pas garantir que « ${fournisseur.code} » n'a jamais servi : il n'en garde que douze mois. Reconnectez-vous pour le supprimer, ou désactivez la fiche dès maintenant.`;
    }
    return motifNonSupprimableFournisseur(fournisseur, auServeur);
  }

  /** Efface définitivement une fiche fournisseur jamais utilisée. */
  async supprimer(fournisseur: FournisseurASupprimer): Promise<void> {
    const motif = motifNonSupprimableFournisseur(fournisseur, await this.usages(fournisseur.id));
    if (motif) throw new Error(motif);
    await this.db.execute('DELETE FROM fournisseurs WHERE id = ?', [fournisseur.id]);
  }

  async codeExiste(filialeId: string, code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>('SELECT id FROM fournisseurs WHERE filiale_id = ? AND code = ? AND id != ? LIMIT 1', [filialeId, code, excludeId ?? '']);
    return rows.length > 0;
  }

  /**
   * Achat réceptionné : pièce d'achat (LIVREE), entrée en stock de chaque ligne
   * au coût saisi (référence = numéro d'achat), dette fournisseur. Tout ou rien.
   */
  enregistrerAchat(ctx: ContexteFournisseur, achat: Achat): Promise<{ id: string; numero: string }> {
    return this.db.writeTransaction(async (tx) => {
      const id = this.nouvelId();
      const numero = achat.reference || numeroPiece('ACH');
      const now = this.maintenant();
      const t = totauxAchat(achat);
      await tx.execute(
        `INSERT INTO commandes_fournisseurs (id, numero, fournisseur_id, date_commande, type, statut, total_ht, total_tva, total_ttc, total_recu_ttc, montant_paye, reste_a_payer,
                                             remise_percent, tva_percent, depot_id, date_reception, notes, utilisateur_id, filiale_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'COMMANDE', 'LIVREE', ?, ?, ?, ?, 0, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, numero, achat.fournisseur_id, now, t.total_ht, t.total_tva, t.total_ttc, t.total_ttc, t.total_ttc, achat.tva_percent, achat.depot_id, now, achat.notes || null, ctx.utilisateurId, ctx.filialeId, now, now],
      );
      const stock = new StockRepository(this.db);
      for (const ligne of fusionnerLignes(achat.lignes)) {
        // La provenance suit la marchandise : sans elle, le journal du stock ne
        // sait plus de qui vient ce qui est entré, et une fiche fournisseur
        // paraîtrait effaçable alors qu'elle a livré.
        await stock.appliquerDansTransaction(tx, ctx, achat.depot_id, 'ENTREE_ACHAT', { article_id: ligne.article_id, quantite: ligne.quantite, cout_unitaire: ligne.cout_unitaire }, numero, `Achat ${numero}`, { fournisseurId: achat.fournisseur_id });
        const a = await tx.get<ArticleRow>('SELECT code, designation, unite FROM articles WHERE id = ?', [ligne.article_id]);
        await this.insererLigneCommande(tx, id, ctx.filialeId, a, ligne.article_id, ligne.quantite, ligne.quantite, ligne.cout_unitaire, now);
      }
      await this.mouvementerDette(tx, achat.fournisseur_id, t.total_ttc, 0);
      return { id, numero };
    });
  }

  /** Bon de commande : pièce + lignes, statut ENVOYEE. Ni stock ni dette avant réception. */
  creerBonCommande(ctx: ContexteFournisseur, bon: BonCommande): Promise<{ id: string; numero: string }> {
    return this.db.writeTransaction(async (tx) => {
      const id = this.nouvelId();
      const numero = bon.numero || numeroPiece('BC');
      const now = this.maintenant();
      const lignes = fusionnerLignes(bon.lignes);
      const t = totauxCommande({ remise_percent: bon.remise_percent, tva_percent: bon.tva_percent, lignes });
      await tx.execute(
        `INSERT INTO commandes_fournisseurs (id, numero, fournisseur_id, date_commande, type, statut, total_ht, total_tva, total_ttc, total_recu_ttc, montant_paye, reste_a_payer,
                                             remise_percent, tva_percent, depot_id, date_livraison_prevue, notes, utilisateur_id, filiale_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'BON_COMMANDE', 'ENVOYEE', ?, ?, ?, 0, 0, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, numero, bon.fournisseur_id, now, t.net_ht, t.tva, t.net_a_payer, bon.remise_percent, bon.tva_percent, bon.depot_id,
         bon.date_livraison_prevue ? new Date(bon.date_livraison_prevue).toISOString() : null, bon.notes || null, ctx.utilisateurId, ctx.filialeId, now, now],
      );
      for (const l of lignes) {
        const a = await tx.get<ArticleRow>('SELECT code, designation, unite FROM articles WHERE id = ?', [l.article_id]);
        await this.insererLigneCommande(tx, id, ctx.filialeId, a, l.article_id, l.quantite, 0, l.prix_unitaire_ht, now, l.remise_percent);
      }
      return { id, numero };
    });
  }

  /**
   * Réception d'un bon de commande (totale ou partielle) : entrée en stock des
   * quantités reçues au prix de commande remisé + TVA, dette fournisseur pour
   * la valeur reçue, statut PARTIELLE ou LIVREE. Tout ou rien.
   */
  receptionner(ctx: ContexteFournisseur, commandeId: string, reception: Reception): Promise<{ total_ttc: number; statut: string }> {
    return this.db.writeTransaction(async (tx) => {
      const c = await tx.get<CommandeFournisseurRow>('SELECT * FROM commandes_fournisseurs WHERE id = ?', [commandeId]);
      if (c.statut !== 'ENVOYEE' && c.statut !== 'PARTIELLE') throw new Error('Cette commande ne peut plus être réceptionnée');
      const lignes = (await tx.getAll<LigneCommandeFournisseurRow>(LIGNES_COMMANDE_QUERY, [commandeId])).map(ligneCommandeFromRow);
      const v = valoriserReception({ remise_percent: c.remise_percent ?? 0, tva_percent: c.tva_percent ?? 0 }, lignes, reception);
      const now = this.maintenant();
      const reference = reception.reference || c.numero || '';
      const stock = new StockRepository(this.db);
      for (const d of v.lignes) {
        await stock.appliquerDansTransaction(tx, ctx, reception.depot_id, 'ENTREE_ACHAT', { article_id: d.ligne.article_id, quantite: d.quantite_recue, cout_unitaire: d.cout_unitaire }, reference, `Réception ${c.numero}`, { fournisseurId: c.fournisseur_id });
        // Pas de colonne updated_at sur les lignes : mise à jour directe.
        await tx.execute('UPDATE lignes_commande_fournisseur SET quantite_recue = ? WHERE id = ?', [d.ligne.quantite_recue + d.quantite_recue, d.ligne.id]);
      }
      const recues = lignes.map((l) => ({ quantite: l.quantite, quantite_recue: l.quantite_recue + (v.lignes.find((d) => d.ligne.id === l.id)?.quantite_recue ?? 0) }));
      const statut = statutApresReception(recues);
      const totalRecu = arrondirMontant((c.total_recu_ttc ?? 0) + v.total_ttc);
      await this.patch(tx, 'commandes_fournisseurs', commandeId, {
        statut, total_recu_ttc: totalRecu, reste_a_payer: Math.max(totalRecu - (c.montant_paye ?? 0), 0), date_reception: now, depot_id: reception.depot_id,
      });
      await this.mouvementerDette(tx, c.fournisseur_id ?? '', v.total_ttc, 0);
      return { total_ttc: v.total_ttc, statut };
    });
  }

  /** Annulation d'un bon de commande non réceptionné. */
  async annulerCommande(id: string): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const c = await tx.get<CommandeFournisseurRow>('SELECT statut FROM commandes_fournisseurs WHERE id = ?', [id]);
      if (c.statut !== 'ENVOYEE' && c.statut !== 'BROUILLON') throw new Error('Seul un bon de commande non réceptionné peut être annulé');
      await this.patch(tx, 'commandes_fournisseurs', id, { statut: 'ANNULEE' });
    });
  }

  private async insererLigneCommande(tx: Transaction, commandeId: string, filialeId: string, a: Pick<ArticleRow, 'code' | 'designation' | 'unite'>, articleId: string, quantite: number, quantiteRecue: number, prixHt: number, now: string, remisePercent = 0): Promise<void> {
    await tx.execute(
      `INSERT INTO lignes_commande_fournisseur (id, commande_id, filiale_id, article_id, code_article, designation, unite, quantite, quantite_recue, prix_unitaire_ht, remise_percent, total_ht, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), commandeId, filialeId, articleId, a.code ?? '', a.designation ?? '', a.unite ?? null, quantite, quantiteRecue, prixHt, remisePercent,
       totalLigneCommande({ quantite, prix_unitaire_ht: prixHt, remise_percent: remisePercent }), now],
    );
  }

  /** Paiement d'un fournisseur (acompte ou solde d'un achat) : pièce, dette, dépense en caisse. */
  enregistrerReglement(ctx: ContexteFournisseur, fournisseurId: string, form: ReglementFournisseurForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const f = await tx.get<FournisseurRow>('SELECT * FROM fournisseurs WHERE id = ?', [fournisseurId]);
      const numero = numeroPiece('RGF');
      const now = this.maintenant();
      const commandeId = form.commande_id || null;
      await tx.execute(
        `INSERT INTO reglements_fournisseurs (id, numero, fournisseur_id, commande_id, date_reglement, montant, type_reglement, reference, caisse_id, utilisateur_id, filiale_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.nouvelId(), numero, fournisseurId, commandeId, now, form.montant, form.type_reglement, form.reference || null, form.caisse_id, ctx.utilisateurId, ctx.filialeId, now],
      );
      await this.mouvementerDette(tx, fournisseurId, 0, form.montant);
      if (commandeId) {
        const c = await tx.get<CommandeFournisseurRow>('SELECT * FROM commandes_fournisseurs WHERE id = ?', [commandeId]);
        const paye = (c.montant_paye ?? 0) + form.montant;
        await this.patch(tx, 'commandes_fournisseurs', commandeId, { montant_paye: paye, reste_a_payer: Math.max((c.total_ttc ?? 0) - paye, 0) });
      }
      await tx.execute(
        `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
         VALUES (?, 'DEPENSE', 'REGLEMENT_FOURNISSEUR', ?, ?, ?, ?, ?, ?, ?, ?)`,
        [this.nouvelId(), form.montant, `Règlement fournisseur ${f.raison_sociale ?? ''}`.trim(), numero, form.caisse_id, ctx.utilisateurId, ctx.filialeId, now, now],
      );
      if (TYPES_EN_CAISSE.has(form.type_reglement)) {
        const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [form.caisse_id]);
        await this.patch(tx, 'caisses', form.caisse_id, { solde_actuel: (caisse.solde_actuel ?? 0) - form.montant });
      }
      return numero;
    });
  }

  private async mouvementerDette(tx: Transaction, fournisseurId: string, facture: number, reglement: number): Promise<void> {
    await mouvementerDetteFournisseur(tx, fournisseurId, facture, reglement, this.maintenant());
  }
}
