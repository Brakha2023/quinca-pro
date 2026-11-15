import type { Transaction } from '@powersync/web';
import type { CaisseRow, DepenseRow } from '@quinca/shared-types';
import { depenseModifiable, type DepenseForm } from '../../../core/depenses';
import { CATEGORIE_REOUVERTURE_DEPENSE } from '../../../core/tresorerie';
import { numeroPiece } from '../../desktop/identitePoste';
import { BaseRepository } from './BaseRepository';

/**
 * Dépenses engagées, approuvées, refusées.
 *
 * Toute la mécanique de caisse tient en une phrase : **une dépense ne sort de
 * la caisse qu'à sa validation.** Tant qu'elle attend, elle ne coûte rien ;
 * c'est pourquoi la corriger ou la refuser ne contre-passe aucune trésorerie,
 * et pourquoi la rouvrir fait rentrer l'argent (`REOUVERTURE_DEPENSE`).
 *
 * C'est le symétrique exact de la vente, dans l'autre sens : là, l'argent
 * entre à la validation ; ici, il sort.
 */

export interface ContexteDepense {
  filialeId: string;
  utilisateurId: string | null;
}

/** La dépense et les noms qui vont avec, pour la liste et le détail. */
export const DEPENSES_QUERY = `
  SELECT d.*, c.nom AS caisse_nom,
         u.nom AS auteur_nom, u.prenom AS auteur_prenom,
         a.nom AS approbateur_nom, a.prenom AS approbateur_prenom
  FROM depenses d
  LEFT JOIN caisses c ON c.id = d.caisse_id
  LEFT JOIN utilisateurs u ON u.id = d.utilisateur_id
  LEFT JOIN utilisateurs a ON a.id = d.valide_par
  WHERE d.filiale_id = ?
    AND date(d.date_depense) BETWEEN ? AND ?
    AND (? = '' OR d.caisse_id = ?)
    AND (? = '' OR d.statut = ?)
    AND (? = '' OR upper(d.numero) LIKE ? OR upper(COALESCE(d.beneficiaire, '')) LIKE ?
         OR upper(COALESCE(d.description, '')) LIKE ? OR upper(COALESCE(d.reference, '')) LIKE ?)
  ORDER BY d.date_depense DESC, d.created_at DESC`;

export interface FiltresDepenses {
  dateDebut: string;
  dateFin: string;
  caisseId: string | null;
  statut: string | null;
  recherche: string;
}

export function depensesParams(filialeId: string | null, f: FiltresDepenses): unknown[] {
  const recherche = f.recherche.trim().toUpperCase();
  const motif = `%${recherche}%`;
  return [
    filialeId ?? '', f.dateDebut, f.dateFin,
    f.caisseId ?? '', f.caisseId ?? '',
    f.statut ?? '', f.statut ?? '',
    recherche, motif, motif, motif, motif,
  ];
}

export class DepensesRepository extends BaseRepository {
  /** Engage une dépense : elle attend une décision, la caisse ne bouge pas. */
  async enregistrer(ctx: ContexteDepense, form: DepenseForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO depenses (id, numero, filiale_id, caisse_id, categorie, montant, beneficiaire, description,
                             reference, date_depense, statut, utilisateur_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EN_ATTENTE', ?, ?, ?)`,
      [
        id, numeroPiece('DEP'), ctx.filialeId, form.caisse_id, form.categorie, form.montant,
        form.beneficiaire, form.description || null, form.reference || null,
        // Le jour saisi, l'heure de l'enregistrement : la pièce peut dater
        // d'hier, mais on garde l'instant où elle est entrée dans le système.
        `${form.date_depense}T${now.slice(11)}`,
        ctx.utilisateurId, now, now,
      ],
    );
    return id;
  }

  /**
   * Corrige une dépense qui attend encore. Rien à contre-passer : elle n'a pas
   * été payée. Le statut est vérifié ici, dans le dépôt, et pas seulement à
   * l'écran — une dépense déjà sortie de la caisse ne se retouche pas.
   */
  async modifier(id: string, form: DepenseForm): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const d = await tx.get<DepenseRow>('SELECT * FROM depenses WHERE id = ?', [id]);
      if (!depenseModifiable(d.statut as 'EN_ATTENTE')) {
        throw new Error('Seule une dépense en attente se modifie. Une dépense validée se remet d’abord en attente.');
      }
      await this.patch(tx, 'depenses', id, {
        caisse_id: form.caisse_id,
        categorie: form.categorie,
        montant: form.montant,
        beneficiaire: form.beneficiaire,
        description: form.description || null,
        reference: form.reference || null,
        date_depense: `${form.date_depense}T${this.maintenant().slice(11)}`,
      });
    });
  }

  /**
   * Approuve des dépenses : elles passent en VALIDEE, **et leur montant sort
   * de la caisse**.
   *
   * Une ligne de journal par pièce, portant son numéro et sa catégorie — le
   * journal de caisse reste lisible pièce par pièce, et une dépense seule peut
   * être rouverte. La ligne est datée du **jour de la validation**, pas de
   * celui de la dépense : c'est le jour où l'argent sort. Un journal de caisse
   * déjà imprimé ne se voit donc pas complété après coup.
   */
  async valider(ctx: ContexteDepense, ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    return this.db.writeTransaction(async (tx) => {
      let n = 0;
      for (const id of ids) {
        const d = await tx.getOptional<DepenseRow>('SELECT * FROM depenses WHERE id = ?', [id]);
        if (d?.statut !== 'EN_ATTENTE') continue;
        await this.mouvementCaisse(tx, ctx, d, 'DEPENSE', d.categorie ?? 'AUTRE_DEPENSE', d.montant ?? 0,
          [d.beneficiaire, d.description].filter(Boolean).join(' — ') || `Dépense ${d.numero}`);
        await this.patch(tx, 'depenses', id, {
          statut: 'VALIDEE',
          valide_par: ctx.utilisateurId,
          date_validation: this.maintenant(),
        });
        n++;
      }
      return n;
    });
  }

  /**
   * Refuse une dépense qui attend. Rien ne bouge en caisse — elle n'y a jamais
   * touché. La pièce reste, avec son motif : c'est la trace de la décision, et
   * ce qui évite que la même demande revienne telle quelle le lendemain.
   */
  async refuser(ctx: ContexteDepense, id: string, motif: string): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const d = await tx.get<DepenseRow>('SELECT statut FROM depenses WHERE id = ?', [id]);
      if (d.statut !== 'EN_ATTENTE') {
        throw new Error(
          d.statut === 'VALIDEE'
            ? 'Cette dépense est déjà payée. Remettez-la en attente avant de la refuser.'
            : 'Cette dépense est déjà refusée.',
        );
      }
      await this.patch(tx, 'depenses', id, {
        statut: 'REFUSEE',
        motif_refus: motif,
        valide_par: ctx.utilisateurId,
        date_validation: this.maintenant(),
      });
    });
  }

  /**
   * Remet une dépense validée en attente : **l'argent rentre en caisse**.
   *
   * L'erreur se voit parfois après l'approbation — mauvais montant, mauvaise
   * caisse, dépense approuvée par mégarde avec le lot. La pièce redevient
   * corrigible et refusable, et la reprise se lit au journal : une sortie
   * d'argent ne s'efface pas, elle se contre-passe.
   *
   * Le montant repris est celui de la pièce, et c'est exact : une dépense ne
   * se modifie qu'en attente, donc son montant n'a pas pu bouger entre la
   * validation et maintenant.
   */
  async remettreEnAttente(ctx: ContexteDepense, id: string): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const d = await tx.get<DepenseRow>('SELECT * FROM depenses WHERE id = ?', [id]);
      if (d.statut !== 'VALIDEE') {
        throw new Error(
          d.statut === 'REFUSEE'
            ? "Une dépense refusée n'a rien sorti de la caisse : il n'y a rien à reprendre. Engagez-la de nouveau si vous changez d'avis."
            : 'Seule une dépense validée se remet en attente.',
        );
      }
      await this.mouvementCaisse(tx, ctx, d, 'RECETTE', CATEGORIE_REOUVERTURE_DEPENSE, d.montant ?? 0,
        `Réouverture de la dépense ${d.numero} : reprise du paiement`);
      await this.patch(tx, 'depenses', id, { statut: 'EN_ATTENTE', valide_par: null, date_validation: null });
    });
  }

  /**
   * Une ligne de journal de caisse au titre d'une dépense, et la projection du
   * solde qui va avec.
   *
   * Le solde n'est écrit ici **qu'en projection**, pour que l'écran réagisse
   * tout de suite : c'est Postgres qui le tient, par delta sur chaque ligne du
   * journal portant une caisse (`cumuler_mouvement_tresorerie`, migration
   * `cumuls_serveur`).
   */
  private async mouvementCaisse(
    tx: Transaction,
    ctx: ContexteDepense,
    depense: Pick<DepenseRow, 'numero' | 'caisse_id'>,
    sens: 'RECETTE' | 'DEPENSE',
    categorie: string,
    montant: number,
    description: string,
  ): Promise<void> {
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), sens, categorie, montant, description, depense.numero, depense.caisse_id, ctx.utilisateurId, ctx.filialeId, now, now],
    );
    if (!depense.caisse_id) return;
    const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [depense.caisse_id]);
    const delta = sens === 'RECETTE' ? montant : -montant;
    await this.patch(tx, 'caisses', depense.caisse_id, { solde_actuel: (caisse.solde_actuel ?? 0) + delta });
  }
}
