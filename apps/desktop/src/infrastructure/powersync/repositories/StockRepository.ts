import type { Transaction } from '@powersync/web';
import type { StockRow, TypeMouvementStock } from '@quinca/shared-types';
import {
  STOCK_VIDE,
  appliquerMouvement,
  fusionnerLignes,
  genererNumeroBon,
  type EntreeStock,
  type EtatStock,
  type Inventaire,
  type SortieStock,
  type TransfertStock,
} from '../../../core/stock';
import { BaseRepository } from './BaseRepository';

export interface ContexteMouvement {
  filialeId: string;
  utilisateurId: string | null;
}

/** Ligne de stock enrichie de l'article et du dépôt, pour les écrans de suivi. */
export interface StockVueRow extends StockRow {
  article_code: string | null;
  article_designation: string | null;
  article_unite: string | null;
  article_prix_achat: number | null;
  article_stock_min: number | null;
  article_stock_max: number | null;
  famille_nom: string | null;
  depot_code: string | null;
  depot_nom: string | null;
}

export interface FiltresStock {
  depotId?: string | null;
  recherche?: string;
  /** Ne garder que les lignes en alerte (quantité ≤ stock min). */
  alertesSeulement?: boolean;
}

export function stocksQuery(filialeId: string | null, filtres: FiltresStock = {}) {
  const conditions = ['s.filiale_id = ?', 'a.est_actif = 1'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.depotId) {
    conditions.push('s.depot_id = ?');
    params.push(filtres.depotId);
  }
  const q = filtres.recherche?.trim();
  if (q) {
    conditions.push('(a.code LIKE ? OR a.designation LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }
  if (filtres.alertesSeulement) conditions.push('s.quantite <= a.stock_min');

  return {
    sql: `SELECT s.*, a.code AS article_code, a.designation AS article_designation, a.unite AS article_unite,
                 a.prix_achat AS article_prix_achat, a.stock_min AS article_stock_min, a.stock_max AS article_stock_max,
                 f.nom AS famille_nom, d.code AS depot_code, d.nom AS depot_nom
          FROM stocks s
          JOIN articles a ON a.id = s.article_id
          LEFT JOIN familles_articles f ON f.id = a.famille_id
          JOIN depots d ON d.id = s.depot_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY a.designation, d.nom`,
    params,
  };
}

/** Stock total par article (tous dépôts), avec les articles sans aucune ligne de stock (quantité 0). */
export function stocksParArticleQuery(filialeId: string | null) {
  return {
    sql: `SELECT a.id AS article_id, a.code, a.designation, a.unite, a.prix_achat, a.stock_min, a.stock_max,
                 COALESCE(SUM(s.quantite), 0) AS quantite, COALESCE(SUM(s.quantite * s.cout_moyen), 0) AS valeur
          FROM articles a
          LEFT JOIN stocks s ON s.article_id = a.id
          WHERE a.filiale_id = ? AND a.est_actif = 1
          GROUP BY a.id
          ORDER BY a.designation`,
    params: [filialeId ?? ''],
  };
}

export interface FiltresMouvements {
  depotId?: string | null;
  articleId?: string | null;
  fournisseurId?: string | null;
  type?: TypeMouvementStock | null;
  reference?: string | null;
  limite?: number;
}

export function mouvementsQuery(filialeId: string | null, filtres: FiltresMouvements = {}) {
  const conditions = ['m.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.depotId) { conditions.push('m.depot_id = ?'); params.push(filtres.depotId); }
  if (filtres.articleId) { conditions.push('m.article_id = ?'); params.push(filtres.articleId); }
  if (filtres.fournisseurId) { conditions.push('m.fournisseur_id = ?'); params.push(filtres.fournisseurId); }
  if (filtres.type) { conditions.push('m.type = ?'); params.push(filtres.type); }
  if (filtres.reference) { conditions.push('m.reference = ?'); params.push(filtres.reference); }
  params.push(filtres.limite ?? 200);
  return {
    sql: `SELECT m.*, a.code AS article_code, a.designation AS article_designation, a.unite AS article_unite, d.nom AS depot_nom,
                 u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom, f.raison_sociale AS fournisseur_nom
          FROM mouvements_stock m
          JOIN articles a ON a.id = m.article_id
          JOIN depots d ON d.id = m.depot_id
          LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
          LEFT JOIN fournisseurs f ON f.id = m.fournisseur_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY m.created_at DESC
          LIMIT ?`,
    params,
  };
}

export interface LigneAAppliquer {
  article_id: string;
  quantite: number;
  cout_unitaire: number | null;
}

export interface OptionsMouvement {
  /** Autorise une sortie au-delà du disponible (stock négatif assumé, ex. vente forcée par un gérant). */
  autoriserNegatif?: boolean;
  /** Fournisseur ayant livré la marchandise (entrées d'achat). */
  fournisseurId?: string | null;
}

/**
 * Écritures de stock. Chaque bon est appliqué dans une transaction locale :
 * lecture de l'état courant, application de la règle métier, mise à jour de
 * `stocks` et journalisation dans `mouvements_stock`. Un échec (stock
 * insuffisant, article inconnu) annule tout le bon.
 */
export class StockRepository extends BaseRepository {
  enregistrerEntree(ctx: ContexteMouvement, entree: EntreeStock): Promise<string> {
    const reference = entree.reference || genererNumeroBon('ENT');
    return this.db.writeTransaction(async (tx) => {
      for (const ligne of fusionnerLignes(entree.lignes)) {
        await this.appliquer(tx, ctx, entree.depot_id, entree.type, {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: ligne.cout_unitaire === '' ? null : ligne.cout_unitaire,
        }, reference, entree.motif || null, { fournisseurId: entree.fournisseur_id });
      }
      return reference;
    });
  }

  enregistrerSortie(ctx: ContexteMouvement, sortie: SortieStock): Promise<string> {
    const reference = sortie.reference || genererNumeroBon(sortie.type === 'CASSE' ? 'CAS' : 'SOR');
    return this.db.writeTransaction(async (tx) => {
      for (const ligne of fusionnerLignes(sortie.lignes)) {
        await this.appliquer(tx, ctx, sortie.depot_id, sortie.type, {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: null,
        }, reference, sortie.motif || null);
      }
      return reference;
    });
  }

  /** Transfert inter-dépôts : sortie du dépôt source puis entrée au dépôt destination, au coût moyen source. */
  transferer(ctx: ContexteMouvement, transfert: TransfertStock): Promise<string> {
    const reference = transfert.reference || genererNumeroBon('TRF');
    return this.db.writeTransaction(async (tx) => {
      for (const ligne of fusionnerLignes(transfert.lignes)) {
        const source = await this.lireEtat(tx, ligne.article_id, transfert.depot_source_id);
        await this.appliquer(tx, ctx, transfert.depot_source_id, 'TRANSFERT_SORTIE', {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: null,
        }, reference, transfert.motif || null);
        await this.appliquer(tx, ctx, transfert.depot_destination_id, 'TRANSFERT_ENTREE', {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: source.cout_moyen,
        }, reference, transfert.motif || null);
      }
      return reference;
    });
  }

  /** Inventaire : la quantité comptée devient la quantité en stock ; seuls les écarts génèrent un mouvement. */
  enregistrerInventaire(ctx: ContexteMouvement, inventaire: Inventaire): Promise<{ reference: string; ecarts: number }> {
    const reference = inventaire.reference || genererNumeroBon('INV');
    return this.db.writeTransaction(async (tx) => {
      let ecarts = 0;
      for (const ligne of inventaire.lignes) {
        const etat = await this.lireEtat(tx, ligne.article_id, inventaire.depot_id);
        if (etat.quantite === ligne.quantite_comptee) continue;
        await this.appliquer(tx, ctx, inventaire.depot_id, 'INVENTAIRE', {
          article_id: ligne.article_id,
          quantite: ligne.quantite_comptee,
          cout_unitaire: null,
        }, reference, inventaire.motif || null);
        ecarts++;
      }
      return { reference, ecarts };
    });
  }

  private async lireEtat(tx: Transaction, articleId: string, depotId: string): Promise<EtatStock & { id: string | null }> {
    const row = await tx.getOptional<StockRow>('SELECT * FROM stocks WHERE article_id = ? AND depot_id = ?', [articleId, depotId]);
    if (!row) return { ...STOCK_VIDE, id: null };
    return {
      id: row.id,
      quantite: row.quantite ?? 0,
      quantite_reservee: row.quantite_reservee ?? 0,
      cout_moyen: row.cout_moyen ?? 0,
    };
  }

  /**
   * Applique un mouvement dans une transaction ouverte par l'appelant
   * (utilisé aussi par les ventes). Lève `StockInsuffisantError` si le
   * disponible ne couvre pas une sortie.
   */
  async appliquerDansTransaction(
    tx: Transaction,
    ctx: ContexteMouvement,
    depotId: string,
    type: TypeMouvementStock,
    ligne: LigneAAppliquer,
    reference: string,
    motif: string | null,
    options: OptionsMouvement = {},
  ): Promise<void> {
    return this.appliquer(tx, ctx, depotId, type, ligne, reference, motif, options);
  }

  private async appliquer(
    tx: Transaction,
    ctx: ContexteMouvement,
    depotId: string,
    type: TypeMouvementStock,
    ligne: LigneAAppliquer,
    reference: string,
    motif: string | null,
    options: OptionsMouvement = {},
  ): Promise<void> {
    const etat = await this.lireEtat(tx, ligne.article_id, depotId);
    const resultat = appliquerMouvement(etat, type, ligne.quantite, ligne.cout_unitaire, { articleId: ligne.article_id, autoriserNegatif: options.autoriserNegatif });
    const now = this.maintenant();

    if (etat.id) {
      await tx.execute(
        `UPDATE stocks SET quantite = ?, quantite_disponible = ?, cout_moyen = ?, date_dernier_mouvement = ?, updated_at = ? WHERE id = ?`,
        [resultat.quantite_apres, resultat.quantite_apres - etat.quantite_reservee, resultat.cout_moyen, now, now, etat.id],
      );
    } else {
      await tx.execute(
        `INSERT INTO stocks (id, article_id, depot_id, filiale_id, quantite, quantite_reservee, quantite_disponible, cout_moyen, date_dernier_mouvement, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
        [this.nouvelId(), ligne.article_id, depotId, ctx.filialeId, resultat.quantite_apres, resultat.quantite_apres, resultat.cout_moyen, now, now],
      );
    }

    await tx.execute(
      `INSERT INTO mouvements_stock (id, article_id, depot_id, filiale_id, type, quantite, quantite_avant, quantite_apres, cout_unitaire, reference, motif, fournisseur_id, utilisateur_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.nouvelId(), ligne.article_id, depotId, ctx.filialeId, type,
        Math.abs(resultat.quantite), resultat.quantite_avant, resultat.quantite_apres,
        ligne.cout_unitaire ?? (type === 'TRANSFERT_ENTREE' ? resultat.cout_moyen : null),
        reference, motif, options.fournisseurId ?? null, ctx.utilisateurId, now,
      ],
    );
  }
}
