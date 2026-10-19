import type { ArticleRow, StockRow } from '@quinca/shared-types';
import { numeroPiece } from '../../desktop/identitePoste';
import { arrondirMontant } from '../../../core/commun/prix';
import { fusionnerLignes, repartirCoutProduction, type ProductionForm } from '../../../core/stock';
import { BaseRepository } from './BaseRepository';
import { StockRepository, type ContexteMouvement } from './StockRepository';

export interface FiltresProductions {
  depotId?: string | null;
  recherche?: string;
  /** Bornes de journée (AAAA-MM-JJ), inclusives. */
  debut?: string | null;
  fin?: string | null;
  limite?: number;
}

export function productionsQuery(filialeId: string | null, filtres: FiltresProductions = {}) {
  const conditions = ['p.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.depotId) { conditions.push('p.depot_id = ?'); params.push(filtres.depotId); }
  if (filtres.debut) { conditions.push('p.date_debut >= ?'); params.push(new Date(`${filtres.debut}T00:00:00`).toISOString()); }
  if (filtres.fin) { conditions.push('p.date_debut <= ?'); params.push(new Date(`${filtres.fin}T23:59:59.999`).toISOString()); }
  const q = filtres.recherche?.trim();
  if (q) {
    conditions.push('(p.numero LIKE ? OR p.equipe LIKE ? OR EXISTS (SELECT 1 FROM lignes_production l WHERE l.production_id = p.id AND (l.designation LIKE ? OR l.code_article LIKE ?)))');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  params.push(filtres.limite ?? 200);
  return {
    sql: `SELECT p.*, d.nom AS depot_nom, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom,
                 (SELECT COUNT(*) FROM lignes_production l WHERE l.production_id = p.id) AS nombre_lignes,
                 (SELECT COALESCE(SUM(quantite), 0) FROM lignes_production l WHERE l.production_id = p.id AND l.sens = 'PRODUIT') AS quantite_produite,
                 (SELECT COALESCE(SUM(pertes), 0) FROM lignes_production l WHERE l.production_id = p.id AND l.sens = 'PRODUIT') AS pertes,
                 (SELECT GROUP_CONCAT(designation, ', ') FROM lignes_production l WHERE l.production_id = p.id AND l.sens = 'PRODUIT') AS produits
          FROM productions p
          JOIN depots d ON d.id = p.depot_id
          LEFT JOIN utilisateurs u ON u.id = p.utilisateur_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY p.date_debut DESC
          LIMIT ?`,
    params,
  };
}

export const LIGNES_PRODUCTION_QUERY = "SELECT * FROM lignes_production WHERE production_id = ? ORDER BY CASE sens WHEN 'MATIERE' THEN 0 ELSE 1 END, designation";

/**
 * Enregistrement d'une production, tout ou rien : pièce, lignes, sortie des
 * matières au coût moyen du dépôt, entrée des produits au coût de revient.
 */
export class ProductionsRepository extends BaseRepository {
  enregistrer(ctx: ContexteMouvement, form: ProductionForm): Promise<{ id: string; numero: string; coutMatieres: number }> {
    return this.db.writeTransaction(async (tx) => {
      const id = this.nouvelId();
      const numero = form.numero || numeroPiece('PRD');
      const now = this.maintenant();
      const stock = new StockRepository(this.db);
      const article = async (articleId: string) => {
        const a = await tx.getOptional<ArticleRow>('SELECT * FROM articles WHERE id = ?', [articleId]);
        if (!a) throw new Error('Article introuvable');
        return a;
      };

      // Matières : valorisées au coût moyen du dépôt avant la sortie.
      let coutMatieres = 0;
      for (const m of fusionnerLignes(form.matieres)) {
        const a = await article(m.article_id);
        const s = await tx.getOptional<StockRow>('SELECT cout_moyen FROM stocks WHERE article_id = ? AND depot_id = ?', [m.article_id, form.depot_id]);
        const coutUnitaire = s?.cout_moyen ?? a.prix_achat ?? 0;
        coutMatieres = arrondirMontant(coutMatieres + coutUnitaire * m.quantite);
        await stock.appliquerDansTransaction(tx, ctx, form.depot_id, 'SORTIE_PRODUCTION', { article_id: m.article_id, quantite: m.quantite, cout_unitaire: null }, numero, `Production ${numero}`);
        await tx.execute(
          `INSERT INTO lignes_production (id, production_id, filiale_id, sens, article_id, code_article, designation, unite, quantite_prevue, quantite, pertes, cout_unitaire, created_at)
           VALUES (?, ?, ?, 'MATIERE', ?, ?, ?, ?, NULL, ?, 0, ?, ?)`,
          [this.nouvelId(), id, ctx.filialeId, m.article_id, a.code, a.designation, a.unite, m.quantite, coutUnitaire, now],
        );
      }

      // Produits : entrée au coût de revient réparti ; les pertes ne rentrent pas en stock.
      const produits = fusionnerLignes(form.produits.map((p) => ({ ...p })));
      const articles = new Map<string, ArticleRow>();
      for (const p of produits) articles.set(p.article_id, await article(p.article_id));
      const couts = repartirCoutProduction(coutMatieres, produits.map((p) => ({ article_id: p.article_id, quantite: p.quantite, prix_achat: articles.get(p.article_id)?.prix_achat ?? 0 })));
      for (const p of produits) {
        const a = articles.get(p.article_id)!;
        const coutUnitaire = couts.get(p.article_id) ?? null;
        if (p.quantite > 0) {
          await stock.appliquerDansTransaction(tx, ctx, form.depot_id, 'ENTREE_PRODUCTION', { article_id: p.article_id, quantite: p.quantite, cout_unitaire: coutUnitaire }, numero, `Production ${numero}`);
        }
        await tx.execute(
          `INSERT INTO lignes_production (id, production_id, filiale_id, sens, article_id, code_article, designation, unite, quantite_prevue, quantite, pertes, cout_unitaire, created_at)
           VALUES (?, ?, ?, 'PRODUIT', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.nouvelId(), id, ctx.filialeId, p.article_id, a.code, a.designation, a.unite, p.quantite_prevue, p.quantite, p.pertes, coutUnitaire, now],
        );
      }

      await tx.execute(
        `INSERT INTO productions (id, numero, depot_id, filiale_id, equipe, date_debut, date_fin, cout_matieres, commentaire, utilisateur_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, numero, form.depot_id, ctx.filialeId, form.equipe || null, new Date(form.date_debut).toISOString(), form.date_fin ? new Date(form.date_fin).toISOString() : null,
         coutMatieres, form.commentaire || null, ctx.utilisateurId, now, now],
      );
      return { id, numero, coutMatieres };
    });
  }
}
