import type { Transaction } from '@powersync/web';
import type { FamilleArticleRow } from '@quinca/shared-types';
import {
  motifNonSupprimable, preparerImport, usagesArticle,
  type Article, type ArticleForm, type LigneImportArticle, type ResultatImport, type UsagesArticle,
} from '../../../core/articles';
import { usagesArticleServeur } from '../../supabase/usagesArticle';
import { BaseRepository } from './BaseRepository';

export interface FiltresArticles {
  recherche?: string;
  familleId?: string | null;
  inclureInactifs?: boolean;
}

/**
 * Requête de liste paramétrée : le filtrage se fait en SQL (pas en JS)
 * pour rester rapide sur un catalogue de plusieurs milliers d'articles.
 */
export function articlesQuery(filialeId: string | null, filtres: FiltresArticles = {}) {
  const conditions = ['filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];

  if (!filtres.inclureInactifs) conditions.push('est_actif = 1');
  if (filtres.familleId) {
    conditions.push('famille_id = ?');
    params.push(filtres.familleId);
  }
  const q = filtres.recherche?.trim();
  if (q) {
    conditions.push('(code LIKE ? OR designation LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  return {
    sql: `SELECT * FROM articles WHERE ${conditions.join(' AND ')} ORDER BY designation`,
    params,
  };
}

/** Catalogue du point de vente : articles actifs avec le disponible du dépôt de vente. */
export function catalogueQuery(filialeId: string | null, depotId: string | null, filtres: FiltresArticles = {}) {
  const conditions = ['a.filiale_id = ?', 'a.est_actif = 1'];
  const params: Array<string | number> = [depotId ?? '', filialeId ?? ''];
  if (filtres.familleId) { conditions.push('a.famille_id = ?'); params.push(filtres.familleId); }
  const q = filtres.recherche?.trim();
  if (q) { conditions.push('(a.code LIKE ? OR a.designation LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
  return {
    sql: `SELECT a.*, COALESCE(s.quantite_disponible, 0) AS stock_disponible
          FROM articles a
          LEFT JOIN stocks s ON s.article_id = a.id AND s.depot_id = ?
          WHERE ${conditions.join(' AND ')}
          ORDER BY a.designation
          LIMIT 200`,
    params,
  };
}

export const ARTICLE_QUERY = 'SELECT * FROM articles WHERE id = ?';

/** Stock de l'article dépôt par dépôt, pour la fiche article. */
export const STOCK_ARTICLE_QUERY = `
  SELECT s.depot_id, d.nom AS depot_nom, s.quantite, s.quantite_reservee, s.quantite_disponible,
         s.cout_moyen, s.date_dernier_mouvement
  FROM stocks s
  JOIN depots d ON d.id = s.depot_id
  WHERE s.article_id = ?
  ORDER BY d.nom`;

/**
 * Ventes de l'article depuis une date. Les ventes annulées sortent du calcul.
 * `dernier_prix` s'appuie sur la règle SQLite des colonnes nues avec MAX() :
 * elles sont lues sur la ligne qui porte le maximum, donc sur la dernière vente.
 */
export const VENTES_ARTICLE_QUERY = `
  SELECT COUNT(DISTINCT l.vente_id) AS nombre_ventes,
         COALESCE(SUM(l.quantite), 0) AS quantite,
         COALESCE(SUM(l.total_ht), 0) AS total_ht,
         COALESCE(SUM(l.total_ttc), 0) AS total_ttc,
         MAX(v.date_vente) AS derniere_date,
         l.prix_unitaire_ttc AS dernier_prix
  FROM lignes_vente l
  JOIN ventes v ON v.id = l.vente_id
  WHERE l.article_id = ? AND v.statut != 'ANNULEE' AND v.date_vente >= ?`;

/** Ventes de l'article mois par mois (`YYYY-MM`), du plus récent au plus ancien. */
export const VENTES_MENSUELLES_ARTICLE_QUERY = `
  SELECT substr(v.date_vente, 1, 7) AS mois,
         COUNT(DISTINCT l.vente_id) AS nombre_ventes,
         COALESCE(SUM(l.quantite), 0) AS quantite,
         COALESCE(SUM(l.total_ht), 0) AS total_ht,
         COALESCE(SUM(l.total_ttc), 0) AS total_ttc
  FROM lignes_vente l
  JOIN ventes v ON v.id = l.vente_id
  WHERE l.article_id = ? AND v.statut != 'ANNULEE' AND v.date_vente >= ?
  GROUP BY mois
  ORDER BY mois DESC
  LIMIT 12`;

/**
 * Tout ce qui nomme l'article, compté d'un coup dans la base du poste.
 *
 * Un brouillon porte son panier en JSON : on y cherche l'identifiant, qui est
 * un UUID et ne se confond avec rien. Les autres tables ont `article_id`.
 */
export const USAGES_ARTICLE_QUERY = `
  SELECT (SELECT COUNT(*) FROM stocks                      WHERE article_id = ?) AS depots,
         (SELECT COUNT(*) FROM mouvements_stock            WHERE article_id = ?) AS mouvements,
         (SELECT COUNT(*) FROM lignes_vente                WHERE article_id = ?) AS ventes,
         (SELECT COUNT(*) FROM lignes_proforma             WHERE article_id = ?) AS devis,
         (SELECT COUNT(*) FROM lignes_commande_fournisseur WHERE article_id = ?) AS commandes,
         (SELECT COUNT(*) FROM lignes_production           WHERE article_id = ?) AS fabrications,
         (SELECT COUNT(*) FROM lignes_transfert_stock      WHERE article_id = ?) AS transferts,
         (SELECT COUNT(*) FROM ventes_brouillons           WHERE lignes LIKE ?)  AS brouillons`;

export interface StockDepotRow {
  depot_id: string;
  depot_nom: string | null;
  quantite: number | null;
  quantite_reservee: number | null;
  quantite_disponible: number | null;
  cout_moyen: number | null;
  date_dernier_mouvement: string | null;
}

export interface VentesArticleRow {
  nombre_ventes: number | null;
  quantite: number | null;
  total_ht: number | null;
  total_ttc: number | null;
  derniere_date: string | null;
  dernier_prix: number | null;
}

export interface VentesMoisRow {
  mois: string;
  nombre_ventes: number | null;
  quantite: number | null;
  total_ht: number | null;
  total_ttc: number | null;
}

export class ArticlesRepository extends BaseRepository {
  async create(filialeId: string, form: ArticleForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO articles (id, code, designation, famille_id, sous_famille, prix_achat, prix_vente, prix_vip, tva,
                             stock_min, stock_max, unite, filiale_id, est_actif, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id, form.code, form.designation, form.famille_id, form.sous_famille || null,
        form.prix_achat, form.prix_vente, form.prix_vip === '' ? null : form.prix_vip, form.tva,
        form.stock_min, form.stock_max, form.unite, filialeId, now, now,
      ],
    );
    return id;
  }

  async update(id: string, form: ArticleForm): Promise<void> {
    await this.patch(this.db, 'articles', id, {
      code: form.code,
      designation: form.designation,
      famille_id: form.famille_id,
      sous_famille: form.sous_famille || null,
      prix_achat: form.prix_achat,
      prix_vente: form.prix_vente,
      prix_vip: form.prix_vip === '' ? null : form.prix_vip,
      tva: form.tva,
      stock_min: form.stock_min,
      stock_max: form.stock_max,
      unite: form.unite,
    });
  }

  /**
   * Un article qui a servi ne se supprime pas : il se désactive. Il quitte le
   * comptoir et les écrans de saisie, son histoire reste lisible.
   */
  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'articles', id, { est_actif: actif ? 1 : 0 });
  }

  /** Ce qui rattache l'article à l'activité, vu depuis la base du poste. */
  async usages(id: string): Promise<UsagesArticle> {
    // `COUNT(*)` rend toujours un nombre : la ligne arrive complète.
    const row = await this.db.get<Partial<UsagesArticle>>(
      USAGES_ARTICLE_QUERY,
      [...Array<string>(7).fill(id), `%${id}%`],
    );
    return usagesArticle(row);
  }

  /**
   * Pourquoi cet article ne peut pas être supprimé — ou `null` s'il peut l'être.
   *
   * Deux regards, dans cet ordre. Le poste répond sans réseau et sans attendre,
   * mais il ne garde que douze mois d'activité : son silence ne prouve rien.
   * Le serveur, lui, a tout l'historique — et c'est lui qui refuserait
   * l'effacement (clés étrangères), donc c'est lui qui tranche. Hors ligne,
   * on ne supprime pas : on le dit, et « Désactiver » reste là.
   */
  async motifDeRefus(article: Pick<Article, 'id' | 'code' | 'designation'>): Promise<string | null> {
    const surLePoste = motifNonSupprimable(article, await this.usages(article.id));
    if (surLePoste) return surLePoste;

    const auServeur = await usagesArticleServeur(article.id);
    if (!auServeur) {
      return `Sans réseau, le poste ne peut pas garantir que « ${article.code} » n'a jamais servi : il n'en garde que douze mois. Reconnectez-vous pour le supprimer, ou désactivez-le dès maintenant.`;
    }
    return motifNonSupprimable(article, auServeur);
  }

  /**
   * Efface définitivement un article jamais utilisé (faute de frappe, doublon,
   * import malheureux). La garde est refaite ici : aucun appelant ne doit
   * pouvoir effacer un article qui a une histoire, même par distraction.
   */
  async supprimer(article: Pick<Article, 'id' | 'code' | 'designation'>): Promise<void> {
    const motif = motifNonSupprimable(article, await this.usages(article.id));
    if (motif) throw new Error(motif);
    await this.db.execute('DELETE FROM articles WHERE id = ?', [article.id]);
  }

  async codeExiste(filialeId: string, code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>(
      'SELECT id FROM articles WHERE filiale_id = ? AND code = ? AND id != ? LIMIT 1',
      [filialeId, code, excludeId ?? ''],
    );
    return rows.length > 0;
  }

  /**
   * Import en masse dans une seule transaction locale. Les codes déjà présents
   * sont ignorés (jamais écrasés) ; les familles inconnues sont créées.
   */
  async importMany(filialeId: string, lignes: LigneImportArticle[]): Promise<ResultatImport> {
    return this.db.writeTransaction(async (tx) => {
      const codesExistants = new Set(
        (await tx.getAll<{ code: string }>('SELECT code FROM articles WHERE filiale_id = ?', [filialeId])).map((r) =>
          (r.code ?? '').toUpperCase(),
        ),
      );
      const { valides, ignores } = preparerImport(lignes, codesExistants);
      const famillesParNom = await this.chargerFamillesParNom(tx, filialeId);
      const now = this.maintenant();

      for (const ligne of valides) {
        const nomFamille = ligne.famille_nom.trim().toUpperCase() || 'DIVERS';
        let familleId = famillesParNom.get(nomFamille);
        if (!familleId) {
          familleId = this.nouvelId();
          await tx.execute(
            `INSERT INTO familles_articles (id, code, nom, filiale_id, est_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
            [familleId, nomFamille.slice(0, 10), nomFamille, filialeId, now, now],
          );
          famillesParNom.set(nomFamille, familleId);
        }

        await tx.execute(
          `INSERT INTO articles (id, code, designation, famille_id, prix_achat, prix_vente, tva, stock_min, stock_max, unite, filiale_id, est_actif, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 18, 0, 0, 'PIECE', ?, 1, ?, ?)`,
          [this.nouvelId(), ligne.code, ligne.designation, familleId, ligne.prix_achat, ligne.prix_vente, filialeId, now, now],
        );
      }

      return { importes: valides.length, ignores };
    });
  }

  private async chargerFamillesParNom(tx: Transaction, filialeId: string): Promise<Map<string, string>> {
    const familles = await tx.getAll<Pick<FamilleArticleRow, 'id' | 'nom'>>(
      'SELECT id, nom FROM familles_articles WHERE filiale_id = ?',
      [filialeId],
    );
    return new Map(familles.map((f) => [(f.nom ?? '').toUpperCase(), f.id]));
  }
}
