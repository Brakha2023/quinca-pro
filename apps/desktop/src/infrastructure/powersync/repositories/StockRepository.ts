import type { Transaction } from '@powersync/web';
import type { StockRow, TypeMouvementStock } from '@quinca/shared-types';
import {
  STOCK_VIDE,
  appliquerMouvement,
  fusionnerLignes,
  repartirRemiseGlobale,
  type EntreeStock,
  type EtatStock,
  type Inventaire,
  type SortieStock,
  type TransfertStock,
} from '../../../core/stock';
import { numeroPiece } from '../../desktop/identitePoste';
import { BaseRepository } from './BaseRepository';
import { porterLivraisonAuCompte } from './compteFournisseur';

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

export interface FiltresAlertes {
  depotId?: string | null;
  familleId?: string | null;
  recherche?: string;
}

/**
 * Stock total par article, avec les articles sans aucune ligne de stock
 * (quantité 0) — ce sont souvent eux, les ruptures.
 *
 * Le dépôt se filtre dans la jointure et non dans le `where` : au `where`, un
 * article absent de ce dépôt disparaîtrait de la liste, alors qu'il y est
 * précisément en rupture.
 */
export function stocksParArticleQuery(filialeId: string | null, filtres: FiltresAlertes = {}) {
  const params: Array<string | number> = [];
  let jointure = 'LEFT JOIN stocks s ON s.article_id = a.id';
  if (filtres.depotId) {
    jointure += ' AND s.depot_id = ?';
    params.push(filtres.depotId);
  }

  const conditions = ['a.filiale_id = ?', 'a.est_actif = 1'];
  params.push(filialeId ?? '');
  if (filtres.familleId) {
    conditions.push('a.famille_id = ?');
    params.push(filtres.familleId);
  }
  const q = filtres.recherche?.trim();
  if (q) {
    conditions.push('(a.code LIKE ? OR a.designation LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  return {
    sql: `SELECT a.id AS article_id, a.code, a.designation, a.unite, a.prix_achat, a.stock_min, a.stock_max,
                 f.nom AS famille_nom,
                 COALESCE(SUM(s.quantite), 0) AS quantite, COALESCE(SUM(s.quantite * s.cout_moyen), 0) AS valeur
          FROM articles a
          ${jointure}
          LEFT JOIN familles_articles f ON f.id = a.famille_id
          WHERE ${conditions.join(' AND ')}
          GROUP BY a.id
          ORDER BY a.designation`,
    params,
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

export interface FiltresBons {
  /** Les natures de mouvement de l'onglet : un historique ne montre que ses propres bons. */
  types: readonly TypeMouvementStock[];
  depotId?: string | null;
  recherche?: string;
  debut?: string;
  fin?: string;
  limite?: number;
}

/**
 * Les bons déjà enregistrés, un par référence.
 *
 * Le regroupement est fait ici, et non après lecture : la limite porte alors
 * sur le nombre de bons et non sur le nombre de mouvements — un bon de
 * quarante lignes ne chasse pas les bons suivants de la liste.
 *
 * Un transfert entre dépôts écrit deux mouvements par article (la sortie puis
 * l'entrée). Une règle unique vaut donc partout : **les lignes d'un bon sont
 * les mouvements qui ne sont pas `TRANSFERT_ENTREE`**, sans quoi tout
 * transfert — lignes, quantités et valeur — paraîtrait double. La sortie porte
 * le coût moyen du dépôt de départ, qui est justement ce que le transfert vaut.
 *
 * `MAX(m.type)` donne la nature du bon : dans chaque famille d'onglet, un bon
 * n'a qu'un seul type, sauf le transfert où `TRANSFERT_SORTIE` l'emporte — le
 * sens dans lequel le bon a été saisi.
 */
export function bonsStockQuery(filialeId: string | null, filtres: FiltresBons) {
  const types = filtres.types.length > 0 ? filtres.types : (['AJUSTEMENT'] as const);
  const conditions = [`m.filiale_id = ?`, `m.reference IS NOT NULL`, `m.reference != ''`, `m.type IN (${types.map(() => '?').join(', ')})`];
  const params: Array<string | number> = [filialeId ?? '', ...types];
  if (filtres.debut) { conditions.push('m.created_at >= ?'); params.push(`${filtres.debut}T00:00:00.000Z`); }
  if (filtres.fin) { conditions.push('m.created_at <= ?'); params.push(`${filtres.fin}T23:59:59.999Z`); }
  // Dépôt et recherche portent sur le bon entier : un bon dont une seule ligne
  // répond reste affiché avec tous ses totaux, et non amputé des autres lignes.
  if (filtres.depotId) {
    conditions.push('EXISTS (SELECT 1 FROM mouvements_stock md WHERE md.reference = m.reference AND md.filiale_id = m.filiale_id AND md.depot_id = ?)');
    params.push(filtres.depotId);
  }
  const q = filtres.recherche?.trim();
  if (q) {
    conditions.push(`(m.reference LIKE ? OR m.motif LIKE ? OR EXISTS (
      SELECT 1 FROM mouvements_stock mr JOIN articles ar ON ar.id = mr.article_id
      WHERE mr.reference = m.reference AND mr.filiale_id = m.filiale_id AND (ar.code LIKE ? OR ar.designation LIKE ?)))`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  params.push(filtres.limite ?? 200);

  return {
    sql: `SELECT m.reference AS reference,
                 MIN(m.created_at) AS date,
                 MAX(m.type) AS type,
                 MAX(CASE WHEN m.type != 'TRANSFERT_ENTREE' THEN d.nom END) AS depot_nom,
                 MAX(CASE WHEN m.type = 'TRANSFERT_ENTREE' THEN d.nom END) AS depot_destination_nom,
                 MAX(f.raison_sociale) AS fournisseur_nom,
                 MAX(m.date_livraison) AS date_livraison,
                 COALESCE(SUM(CASE WHEN m.type != 'TRANSFERT_ENTREE' THEN m.remise_montant ELSE 0 END), 0) AS remise,
                 MAX(m.motif) AS motif,
                 MAX(u.nom) AS utilisateur_nom,
                 MAX(u.prenom) AS utilisateur_prenom,
                 COUNT(CASE WHEN m.type != 'TRANSFERT_ENTREE' THEN 1 END) AS nombre_lignes,
                 COALESCE(SUM(CASE WHEN m.type != 'TRANSFERT_ENTREE' THEN m.quantite ELSE 0 END), 0) AS quantite,
                 COALESCE(SUM(CASE WHEN m.type != 'TRANSFERT_ENTREE' AND m.cout_unitaire IS NOT NULL THEN ABS(m.quantite) * m.cout_unitaire ELSE 0 END), 0) AS valeur,
                 COUNT(CASE WHEN m.type != 'TRANSFERT_ENTREE' THEN m.cout_unitaire END) AS lignes_valorisees,
                 GROUP_CONCAT(CASE WHEN m.type != 'TRANSFERT_ENTREE' THEN a.designation END, ', ') AS articles
          FROM mouvements_stock m
          JOIN articles a ON a.id = m.article_id
          JOIN depots d ON d.id = m.depot_id
          LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
          LEFT JOIN fournisseurs f ON f.id = m.fournisseur_id
          WHERE ${conditions.join(' AND ')}
          GROUP BY m.reference
          ORDER BY date DESC
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
  /** Part de la remise du bon portée par la ligne, en francs : justifie le coût net retenu. */
  remiseMontant?: number;
  /** Arrivée réelle de la marchandise, quand elle a été saisie (bon de livraison). */
  dateLivraison?: string | null;
}

/**
 * Écritures de stock. Chaque bon est appliqué dans une transaction locale :
 * lecture de l'état courant, application de la règle métier, mise à jour de
 * `stocks` et journalisation dans `mouvements_stock`. Un échec (stock
 * insuffisant, article inconnu) annule tout le bon.
 */
export class StockRepository extends BaseRepository {
  /**
   * Entrée en stock : achat réceptionné ou retour client.
   *
   * La remise se négocie sur le bon entier et en francs ; elle est redescendue
   * sur les lignes au prorata de leur valeur (voir `repartirRemiseGlobale`),
   * car le stock se valorise article par article. Le coût **net** est ce qui
   * alimente le coût moyen pondéré du dépôt.
   *
   * Quand un fournisseur est désigné, la même transaction porte la livraison à
   * son compte : la marchandise entrée est la marchandise due, et un bon
   * d'entrée qui n'engagerait rien obligerait à ressaisir l'achat ailleurs.
   */
  enregistrerEntree(ctx: ContexteMouvement, entree: EntreeStock): Promise<string> {
    const reference = entree.reference || numeroPiece('ENT');
    const dateLivraison = entree.date_livraison ? new Date(entree.date_livraison).toISOString() : null;
    return this.db.writeTransaction(async (tx) => {
      const parts = repartirRemiseGlobale(fusionnerLignes(entree.lignes), entree.remise);
      for (const { ligne, remise, cout_unitaire_net } of parts) {
        await this.appliquer(tx, ctx, entree.depot_id, entree.type, {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: cout_unitaire_net,
        }, reference, entree.motif || null, { fournisseurId: entree.fournisseur_id, remiseMontant: remise, dateLivraison });
      }
      // Une ligne sans coût saisi ne doit rien : on ne sait pas ce qu'elle
      // vaut. Un bon qui n'en porte aucun ne crée donc aucune pièce — une
      // pièce à 0 F encombrerait les achats du fournisseur sans rien dire.
      const dues = parts
        .filter((p) => p.cout_unitaire_net != null)
        .map((p) => ({ article_id: p.ligne.article_id, quantite: p.ligne.quantite, cout_unitaire: p.cout_unitaire_net as number }));
      if (entree.fournisseur_id && dues.length > 0) {
        await porterLivraisonAuCompte(tx, {
          filialeId: ctx.filialeId,
          utilisateurId: ctx.utilisateurId,
          fournisseurId: entree.fournisseur_id,
          reference,
          depotId: entree.depot_id,
          dateLivraison,
          remise: entree.remise,
          motif: entree.motif || null,
          now: this.maintenant(),
          lignes: dues,
        });
      }
      return reference;
    });
  }

  enregistrerSortie(ctx: ContexteMouvement, sortie: SortieStock): Promise<string> {
    const reference = sortie.reference || numeroPiece(sortie.type === 'CASSE' ? 'CAS' : 'SOR');
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
    const reference = transfert.reference || numeroPiece('TRF');
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
    const reference = inventaire.reference || numeroPiece('INV');
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
      `INSERT INTO mouvements_stock (id, article_id, depot_id, filiale_id, type, quantite, quantite_avant, quantite_apres, cout_unitaire, reference, motif, fournisseur_id, remise_montant, date_livraison, utilisateur_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.nouvelId(), ligne.article_id, depotId, ctx.filialeId, type,
        Math.abs(resultat.quantite), resultat.quantite_avant, resultat.quantite_apres,
        // Une sortie vaut le coût moyen du dépôt au moment où elle part. Sans
        // lui, un bon de casse ou de transfert ne dit pas ce qu'il a coûté, et
        // le coût moyen d'aujourd'hui ne le dira plus jamais exactement.
        ligne.cout_unitaire ?? resultat.cout_moyen,
        reference, motif, options.fournisseurId ?? null, options.remiseMontant ?? 0, options.dateLivraison ?? null, ctx.utilisateurId, now,
      ],
    );
  }
}
