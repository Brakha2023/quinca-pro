import type { Transaction } from '@powersync/web';
import type { FamilleArticleRow } from '@quinca/shared-types';
import { preparerImport, type ArticleForm, type LigneImportArticle, type ResultatImport } from '../../../core/articles';
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

  /** Un article ne se supprime jamais (historique des ventes) : il se désactive. */
  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'articles', id, { est_actif: actif ? 1 : 0 });
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
