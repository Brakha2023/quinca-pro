import type { Transaction } from '@powersync/web';
import type { CaisseRow, CommandeFournisseurRow, FournisseurRow } from '@quinca/shared-types';
import { TYPES_EN_CAISSE } from '../../../core/clients';
import { genererCodeTiers, genererNumeroPiece } from '../../../core/commun/numerotation';
import { calculerDette, totauxAchat, type Achat, type FournisseurForm, type ReglementFournisseurForm } from '../../../core/fournisseurs';
import { fusionnerLignes } from '../../../core/stock';
import { BaseRepository } from './BaseRepository';
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
  if (q) { conditions.push('(code LIKE ? OR raison_sociale LIKE ? OR telephone LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  return { sql: `SELECT * FROM fournisseurs WHERE ${conditions.join(' AND ')} ORDER BY raison_sociale`, params };
}

export const ACHATS_FOURNISSEUR_QUERY = 'SELECT * FROM commandes_fournisseurs WHERE fournisseur_id = ? ORDER BY date_commande DESC';
export const REGLEMENTS_FOURNISSEUR_QUERY = `
  SELECT r.*, c.nom AS caisse_nom FROM reglements_fournisseurs r LEFT JOIN caisses c ON c.id = r.caisse_id
  WHERE r.fournisseur_id = ? ORDER BY r.date_reglement DESC`;

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
      });
    });
  }

  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'fournisseurs', id, { est_actif: actif ? 1 : 0 });
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
      const numero = achat.reference || genererNumeroPiece('ACH');
      const now = this.maintenant();
      const t = totauxAchat(achat);
      await tx.execute(
        `INSERT INTO commandes_fournisseurs (id, numero, fournisseur_id, date_commande, type, statut, total_ht, total_tva, total_ttc, montant_paye, reste_a_payer, notes, filiale_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'COMMANDE', 'LIVREE', ?, ?, ?, 0, ?, ?, ?, ?, ?)`,
        [id, numero, achat.fournisseur_id, now, t.total_ht, t.total_tva, t.total_ttc, t.total_ttc, achat.notes || null, ctx.filialeId, now, now],
      );
      const stock = new StockRepository(this.db);
      for (const ligne of fusionnerLignes(achat.lignes)) {
        await stock.appliquerDansTransaction(tx, ctx, achat.depot_id, 'ENTREE_ACHAT', { article_id: ligne.article_id, quantite: ligne.quantite, cout_unitaire: ligne.cout_unitaire }, numero, `Achat ${numero}`);
      }
      await this.mouvementerDette(tx, achat.fournisseur_id, t.total_ttc, 0);
      return { id, numero };
    });
  }

  /** Paiement d'un fournisseur (acompte ou solde d'un achat) : pièce, dette, dépense en caisse. */
  enregistrerReglement(ctx: ContexteFournisseur, fournisseurId: string, form: ReglementFournisseurForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const f = await tx.get<FournisseurRow>('SELECT * FROM fournisseurs WHERE id = ?', [fournisseurId]);
      const numero = genererNumeroPiece('RGF');
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
    const f = await tx.get<FournisseurRow>('SELECT * FROM fournisseurs WHERE id = ?', [fournisseurId]);
    const cumul_factures = (f.cumul_factures ?? 0) + facture;
    const cumul_reglements = (f.cumul_reglements ?? 0) + reglement;
    await this.patch(tx, 'fournisseurs', fournisseurId, {
      cumul_factures, cumul_reglements,
      solde_actuel: calculerDette({ solde_initial: f.solde_initial ?? 0, cumul_factures, cumul_reglements }),
    });
  }
}
