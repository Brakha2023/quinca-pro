import type { CommonPowerSyncDatabase, Transaction } from '@powersync/web';
import type { ArticleRow, FamilleArticleRow } from '@quinca/shared-types';
import { v4 as uuidv4 } from 'uuid';

export type { ArticleRow };
export type FamilleRow = Pick<FamilleArticleRow, 'id' | 'code' | 'nom'>;

export interface NouvelArticle {
  code: string;
  designation: string;
  famille_id: string | null;
  prix_achat: number;
  prix_vente: number;
  tva: number;
  stock_min: number;
  stock_max: number;
  unite: string;
}

export interface LigneImportArticle {
  code: string;
  designation: string;
  prix_achat: number;
  prix_vente: number;
  famille_nom: string;
}

export const ARTICLES_QUERY = 'SELECT * FROM articles WHERE filiale_id = ? AND est_actif = 1 ORDER BY designation';
export const FAMILLES_QUERY =
  'SELECT id, code, nom FROM familles_articles WHERE filiale_id = ? AND est_active = 1 ORDER BY nom';

/**
 * Accès en écriture aux articles et familles dans la base locale.
 * Les identifiants sont générés côté client (UUID v4) : indispensable hors ligne.
 */
export class ArticlesRepository {
  constructor(private readonly db: CommonPowerSyncDatabase) {}

  async create(filialeId: string, article: NouvelArticle): Promise<string> {
    const id = uuidv4();
    const now = new Date().toISOString();
    await this.db.execute(
      `INSERT INTO articles (id, code, designation, famille_id, prix_achat, prix_vente, tva, stock_min, stock_max, unite, filiale_id, est_actif, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        article.code,
        article.designation,
        article.famille_id,
        article.prix_achat,
        article.prix_vente,
        article.tva,
        article.stock_min,
        article.stock_max,
        article.unite,
        filialeId,
        now,
        now,
      ],
    );
    return id;
  }

  /**
   * Import en masse dans une seule transaction locale : soit tout, soit rien.
   * Les familles inconnues sont créées à la volée.
   */
  async importMany(filialeId: string, lignes: LigneImportArticle[]): Promise<number> {
    return this.db.writeTransaction(async (tx) => {
      const famillesParNom = await this.chargerFamillesParNom(tx, filialeId);
      const now = new Date().toISOString();
      let count = 0;

      for (const ligne of lignes) {
        const nomFamille = ligne.famille_nom.trim().toUpperCase() || 'DIVERS';
        let familleId = famillesParNom.get(nomFamille);

        if (!familleId) {
          familleId = uuidv4();
          await tx.execute(
            `INSERT INTO familles_articles (id, code, nom, filiale_id, est_active, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
            [familleId, nomFamille.slice(0, 10), nomFamille, filialeId, now, now],
          );
          famillesParNom.set(nomFamille, familleId);
        }

        await tx.execute(
          `INSERT INTO articles (id, code, designation, famille_id, prix_achat, prix_vente, tva, stock_min, stock_max, unite, filiale_id, est_actif, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 18, 10, 100, 'PIECE', ?, 1, ?, ?)`,
          [uuidv4(), ligne.code, ligne.designation, familleId, ligne.prix_achat, ligne.prix_vente, filialeId, now, now],
        );
        count++;
      }

      return count;
    });
  }

  private async chargerFamillesParNom(tx: Transaction, filialeId: string): Promise<Map<string, string>> {
    const familles = await tx.getAll<FamilleRow>(FAMILLES_QUERY, [filialeId]);
    return new Map(familles.map((f) => [(f.nom ?? '').toUpperCase(), f.id]));
  }
}
