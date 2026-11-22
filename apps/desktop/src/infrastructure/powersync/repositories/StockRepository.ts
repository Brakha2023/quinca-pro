import type { Transaction } from '@powersync/web';
import type { ArticleRow, StockRow, TypeMouvementStock } from '@quinca/shared-types';
import { articleFromRow, type Article } from '../../../core/articles';
import {
  STOCK_VIDE,
  appliquerMouvement,
  fusionnerLignes,
  repartirRemiseGlobale,
  TYPES_SORTIE_ROTATION,
  type EntreeStock,
  type EtatStock,
  type Inventaire,
  type SortieStock,
  type ImpactCorrection,
  type TransfertStock,
} from '../../../core/stock';
import { coutBrutDepuisLigne, motifNonCorrigeable } from '../../../core/stock';
import { numeroCourt, numeroPiece } from '../../desktop/identitePoste';
import { BaseRepository } from './BaseRepository';
import { mouvementerDetteFournisseur, porterLivraisonAuCompte } from './compteFournisseur';

/** Un bon d'entrée relu pour être rouvert dans le formulaire de saisie. */
export interface BonEntreeRelu {
  reference: string;
  depot_id: string;
  type: 'ENTREE_ACHAT' | 'RETOUR_CLIENT';
  fournisseur_id: string;
  motif: string;
  date_livraison: string | null;
  /** Remise globale du bon, recomposée depuis les parts portées par les lignes. */
  remise: number;
  lignes: Array<{ article: Article; quantite: number; cout_unitaire: number | '' }>;
}

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
  /** Prix de vente du catalogue : la ligne se valorise aussi à ce qu'elle rapporterait. */
  article_prix_vente: number | null;
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
                 a.prix_achat AS article_prix_achat, a.prix_vente AS article_prix_vente,
                 a.stock_min AS article_stock_min, a.stock_max AS article_stock_max,
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

export interface FiltresRotation {
  depotId?: string | null;
  familleId?: string | null;
  recherche?: string;
  /** Début de la période observée (ISO) : ce qui est sorti depuis est compté. */
  depuis: string;
}

/**
 * Stock par article, avec sa **dernière sortie** et ce qui est sorti sur la
 * période : de quoi séparer ce qui dort de ce qui tourne (voir `rotation.ts`).
 *
 * Les sorties sont regroupées une fois pour toutes dans une sous-requête,
 * plutôt que relues article par article : un magasin a quelques milliers
 * d'articles et des dizaines de milliers de mouvements.
 *
 * Le dépôt filtre les deux côtés — le stock et les sorties — sans quoi un
 * article vendu depuis un autre dépôt paraîtrait tourner ici.
 */
export function rotationStockQuery(filialeId: string | null, filtres: FiltresRotation) {
  const types = TYPES_SORTIE_ROTATION;
  // Les paramètres suivent l'ordre du texte SQL, et non celui du raisonnement :
  // la jointure des stocks vient avant la sous-requête des sorties.
  const params: Array<string | number> = [];
  let jointureStock = 'LEFT JOIN stocks s ON s.article_id = a.id';
  if (filtres.depotId) {
    jointureStock += ' AND s.depot_id = ?';
    params.push(filtres.depotId);
  }

  params.push(filtres.depuis, filialeId ?? '', ...types);
  let conditionDepot = '';
  if (filtres.depotId) {
    conditionDepot = ' AND m.depot_id = ?';
    params.push(filtres.depotId);
  }

  const conditions = ['a.filiale_id = ?', 'a.est_actif = 1'];
  params.push(filialeId ?? '');
  if (filtres.familleId) { conditions.push('a.famille_id = ?'); params.push(filtres.familleId); }
  const q = filtres.recherche?.trim();
  if (q) { conditions.push('(a.code LIKE ? OR a.designation LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }

  return {
    sql: `SELECT a.id AS article_id, a.code, a.designation, a.unite, f.nom AS famille_nom,
                 COALESCE(SUM(s.quantite), 0) AS quantite,
                 COALESCE(SUM(s.quantite * s.cout_moyen), 0) AS valeur,
                 MAX(sorties.derniere_sortie) AS derniere_sortie,
                 COALESCE(MAX(sorties.quantite_sortie), 0) AS quantite_sortie
          FROM articles a
          ${jointureStock}
          LEFT JOIN familles_articles f ON f.id = a.famille_id
          LEFT JOIN (
            SELECT m.article_id AS article_id,
                   MAX(m.created_at) AS derniere_sortie,
                   COALESCE(SUM(CASE WHEN m.created_at >= ? THEN ABS(m.quantite) ELSE 0 END), 0) AS quantite_sortie
            FROM mouvements_stock m
            WHERE m.filiale_id = ? AND m.type IN (${types.map(() => '?').join(', ')})${conditionDepot}
            GROUP BY m.article_id
          ) sorties ON sorties.article_id = a.id
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
    sql: `SELECT m.*, a.code AS article_code, a.designation AS article_designation, a.unite AS article_unite,
                 a.poids_tonnes AS article_poids_tonnes, d.nom AS depot_nom,
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
    conditions.push(`(m.reference LIKE ? OR m.reference_courte LIKE ? OR m.motif LIKE ? OR EXISTS (
      SELECT 1 FROM mouvements_stock mr JOIN articles ar ON ar.id = mr.article_id
      WHERE mr.reference = m.reference AND mr.filiale_id = m.filiale_id AND (ar.code LIKE ? OR ar.designation LIKE ?)))`);
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
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
  /**
   * Numéro court du bon auquel la ligne appartient (`ENT-AN8-000012`).
   * Toutes les lignes d'un bon portent le même, comme `reference`. Nul quand
   * la référence a été saisie à la main : elle est alors le numéro de la pièce.
   */
  referenceCourte?: string | null;
}

/**
 * Les deux numéros d'un bon : le **long**, qui l'identifie et que porte le
 * code-barres, et le **court**, qui se lit et se dicte (`ENT-AN8-000012`).
 *
 * Une référence saisie à la main — le numéro du bon de livraison du
 * fournisseur, le plus souvent — est reprise telle quelle et n'appelle aucun
 * numéro court : elle *est* le numéro de la pièce, lui en adjoindre un second
 * reviendrait à imprimer deux numéros sur le même bon.
 */
function numerosDuBon(referenceSaisie: string | null | undefined, prefixe: string): { reference: string; referenceCourte: string | null } {
  return referenceSaisie
    ? { reference: referenceSaisie, referenceCourte: null }
    : { reference: numeroPiece(prefixe), referenceCourte: numeroCourt(prefixe) };
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
    const { reference, referenceCourte } = numerosDuBon(entree.reference, 'ENT');
    return this.db.writeTransaction(async (tx) => {
      await this.ecrireBonEntree(tx, ctx, entree, reference, referenceCourte);
      return reference;
    });
  }

  /**
   * Le corps d'un bon d'entrée, dans une transaction ouverte par l'appelant :
   * écrit par l'enregistrement comme par la correction, qui doit produire
   * exactement le même bon — mêmes numéros, même pièce au compte du
   * fournisseur.
   */
  private async ecrireBonEntree(
    tx: Transaction,
    ctx: ContexteMouvement,
    entree: EntreeStock,
    reference: string,
    referenceCourte: string | null,
  ): Promise<void> {
    const dateLivraison = entree.date_livraison ? new Date(entree.date_livraison).toISOString() : null;
    {
      const parts = repartirRemiseGlobale(fusionnerLignes(entree.lignes), entree.remise);
      for (const { ligne, remise, cout_unitaire_net } of parts) {
        await this.appliquer(tx, ctx, entree.depot_id, entree.type, {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: cout_unitaire_net,
        }, reference, entree.motif || null, { fournisseurId: entree.fournisseur_id, remiseMontant: remise, dateLivraison, referenceCourte });
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
    }
  }

  /**
   * Ce qu'un bon d'entrée a mis en stock **et qui y est encore**, article par
   * article, avec l'état du dépôt aujourd'hui.
   *
   * On lit le net signé de tous les mouvements du bon, et non ses lignes
   * d'origine : un bon déjà corrigé une fois porte son entrée, sa
   * contre-passation et sa nouvelle entrée. Le net dit ce qui reste en vigueur
   * — c'est cela qu'une annulation doit retirer, pas la saisie du premier jour.
   *
   * Pour l'écran, qui ne fait que demander ce que coûterait la correction. La
   * contre-passation, elle, passe par `impactsDuBon` avec sa propre
   * transaction : voir le cartouche de cette méthode.
   */
  async impactCorrectionEntree(filialeId: string, reference: string): Promise<ImpactCorrection[]> {
    return this.impactsDuBon(this.db, filialeId, reference);
  }

  /**
   * Le même calcul, mais sur le lecteur qu'on lui donne.
   *
   * **Le lecteur se passe, il ne se suppose pas.** Appelée depuis l'intérieur
   * d'un `writeTransaction`, cette lecture ne doit pas repartir par `this.db` :
   * la transaction tient le verrou d'écriture, la nouvelle lecture l'attend, et
   * le poste se fige — c'est exactement ce qui gelait la correction d'un bon.
   * Et même si elle passait, elle lirait l'état d'avant la transaction : une
   * correction écrirait alors ses mouvements sur un stock périmé.
   */
  private async impactsDuBon(
    lecteur: Pick<Transaction, 'getAll' | 'getOptional'>,
    filialeId: string,
    reference: string,
  ): Promise<ImpactCorrection[]> {
    const lignes = await lecteur.getAll<{
      article_id: string; depot_id: string; net: number; code: string | null; designation: string | null;
    }>(
      `SELECT m.article_id, m.depot_id, SUM(m.quantite_apres - m.quantite_avant) AS net,
              a.code, a.designation
         FROM mouvements_stock m
         JOIN articles a ON a.id = m.article_id
        WHERE m.reference = ? AND m.filiale_id = ?
        GROUP BY m.article_id, m.depot_id
       HAVING SUM(m.quantite_apres - m.quantite_avant) <> 0`,
      [reference, filialeId],
    );
    const impacts: ImpactCorrection[] = [];
    for (const l of lignes) {
      const etat = await this.lireEtat(lecteur, l.article_id, l.depot_id);
      impacts.push({
        article_id: l.article_id,
        depot_id: l.depot_id,
        code: l.code ?? '',
        designation: l.designation ?? '',
        quantite_retiree: l.net,
        quantite_avant: etat.quantite,
        quantite_apres: etat.quantite - l.net,
      });
    }
    return impacts;
  }

  /**
   * Un bon d'entrée relu tel qu'il est **en vigueur**, pour le rouvrir dans le
   * formulaire de saisie.
   *
   * On prend la dernière ligne d'entrée de chaque article : un bon déjà
   * corrigé porte son entrée d'origine, sa contre-passation et la nouvelle —
   * c'est cette dernière qui dit le contenu du bon aujourd'hui. Le coût est
   * remis au brut (voir `coutBrutDepuisLigne`), et la remise globale est la
   * somme des parts portées par les lignes.
   */
  async lireBonEntree(filialeId: string, reference: string): Promise<BonEntreeRelu | null> {
    const lignes = await this.db.getAll<ArticleRow & {
      article_id: string;
      quantite: number | null; cout_unitaire: number | null; remise_montant: number | null;
      depot_id: string; type: string; fournisseur_id: string | null; motif: string | null; date_livraison: string | null;
    }>(
      // L'article entier : le formulaire de saisie travaille sur la fiche, pas
      // sur un code et une désignation.
      `SELECT a.*, m.article_id,
              m.quantite, m.cout_unitaire, m.remise_montant,
              m.depot_id, m.type, m.fournisseur_id, m.motif, m.date_livraison
         FROM mouvements_stock m
         JOIN articles a ON a.id = m.article_id
        WHERE m.reference = ? AND m.filiale_id = ? AND m.type IN ('ENTREE_ACHAT', 'RETOUR_CLIENT')
          AND m.created_at = (SELECT MAX(x.created_at) FROM mouvements_stock x
                               WHERE x.reference = m.reference AND x.article_id = m.article_id
                                 AND x.type IN ('ENTREE_ACHAT', 'RETOUR_CLIENT'))
        ORDER BY a.code`,
      [reference, filialeId],
    );
    if (lignes.length === 0) return null;
    const tete = lignes[0]!;
    return {
      reference,
      depot_id: tete.depot_id,
      type: tete.type === 'RETOUR_CLIENT' ? 'RETOUR_CLIENT' : 'ENTREE_ACHAT',
      fournisseur_id: tete.fournisseur_id ?? '',
      motif: tete.motif ?? '',
      date_livraison: tete.date_livraison,
      remise: lignes.reduce((s, l) => s + (l.remise_montant ?? 0), 0),
      lignes: lignes.map((l) => ({
        article: articleFromRow({ ...l, id: l.article_id }),
        quantite: l.quantite ?? 0,
        cout_unitaire: coutBrutDepuisLigne({
          quantite: l.quantite ?? 0,
          cout_unitaire: l.cout_unitaire,
          remise_montant: l.remise_montant ?? 0,
        }),
      })),
    };
  }

  /**
   * Annule un bon d'entrée : la marchandise ressort du stock, et la pièce
   * portée au compte du fournisseur est annulée avec elle.
   *
   * Rien n'est effacé — ni le bon, ni ses mouvements, ni la pièce : c'est une
   * contre-passation (voir le cartouche de `core/stock/correction.ts`). Le
   * stock peut passer sous zéro si la marchandise est déjà partie : c'est la
   * vérité du moment, et l'écran l'annonce avant de confirmer.
   */
  async annulerEntree(ctx: ContexteMouvement, reference: string, motif: string): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      await this.contrePasserEntree(tx, ctx, reference, motif ? `Annulation du bon ${reference} : ${motif}` : `Annulation du bon ${reference}`);
    });
  }

  /**
   * Corrige un bon d'entrée : l'ancien est contre-passé, le nouveau écrit sous
   * **les mêmes numéros** — c'est le même papier, corrigé, et non un second
   * bon qui ferait double emploi dans les achats du fournisseur.
   */
  async modifierEntree(ctx: ContexteMouvement, reference: string, entree: EntreeStock): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const courte = await tx.getOptional<{ reference_courte: string | null }>(
        'SELECT reference_courte FROM mouvements_stock WHERE reference = ? AND filiale_id = ? AND reference_courte IS NOT NULL LIMIT 1',
        [reference, ctx.filialeId],
      );
      await this.contrePasserEntree(tx, ctx, reference, `Correction du bon ${reference}`);
      await this.ecrireBonEntree(tx, ctx, { ...entree, reference }, reference, courte?.reference_courte ?? null);
    });
  }

  /**
   * Le cœur commun de l'annulation et de la correction : sortir du stock ce
   * que le bon y a mis, et défaire la pièce du fournisseur.
   *
   * La contre-passation est un `AJUSTEMENT` de quantité négative : c'est la
   * nature prévue pour une écriture qui corrige les registres, et non un
   * déstockage — la marchandise ne quitte pas le magasin, elle n'y est jamais
   * entrée. Le coût moyen n'est pas déplacé, un delta négatif ne le touchant
   * pas (côté serveur comme côté poste).
   */
  private async contrePasserEntree(
    tx: Transaction,
    ctx: ContexteMouvement,
    reference: string,
    motif: string,
  ): Promise<void> {
    const impacts = await this.impactsDuBon(tx, ctx.filialeId, reference);
    const piece = await this.pieceFournisseurDuBon(tx, ctx.filialeId, reference);
    const refus = motifNonCorrigeable({
      netEnStock: impacts.reduce((s, i) => s + i.quantite_retiree, 0),
      montantPaye: piece?.montant_paye ?? 0,
      numeroPiece: piece?.numero ?? null,
    });
    if (refus) throw new Error(refus);

    for (const i of impacts) {
      await this.appliquer(
        tx, ctx, i.depot_id, 'AJUSTEMENT',
        { article_id: i.article_id, quantite: -i.quantite_retiree, cout_unitaire: null },
        reference, motif,
      );
    }

    if (piece) {
      const now = this.maintenant();
      await tx.execute(
        `UPDATE commandes_fournisseurs SET statut = 'ANNULEE', notes = ?, updated_at = ? WHERE id = ?`,
        [[piece.notes, motif].filter(Boolean).join(' · '), now, piece.id],
      );
      // La dette du fournisseur se défait ici en projection ; le déclencheur
      // serveur la refait à partir du statut (voir `cumuls_tiers`).
      if (piece.fournisseur_id) {
        await mouvementerDetteFournisseur(tx, piece.fournisseur_id, -(piece.total_recu_ttc ?? 0), 0, now);
      }
    }
  }

  /**
   * La pièce portée au compte du fournisseur par un bon d'entrée.
   *
   * Elle porte le numéro du bon quand il était libre, et le sien sinon (voir
   * `numeroLibre`) — mais elle cite toujours le bon en note. On cherche donc
   * par les deux, et jamais une pièce déjà annulée.
   */
  private async pieceFournisseurDuBon(tx: Transaction, filialeId: string, reference: string) {
    return tx.getOptional<{
      id: string; numero: string | null; fournisseur_id: string | null;
      total_recu_ttc: number | null; montant_paye: number | null; notes: string | null;
    }>(
      `SELECT id, numero, fournisseur_id, total_recu_ttc, montant_paye, notes
         FROM commandes_fournisseurs
        WHERE filiale_id = ? AND statut <> 'ANNULEE'
          AND (numero = ? OR notes LIKE ?)
        LIMIT 1`,
      [filialeId, reference, `%Entrée en stock ${reference}%`],
    );
  }

  enregistrerSortie(ctx: ContexteMouvement, sortie: SortieStock): Promise<string> {
    const { reference, referenceCourte } = numerosDuBon(sortie.reference, sortie.type === 'CASSE' ? 'CAS' : 'SOR');
    return this.db.writeTransaction(async (tx) => {
      for (const ligne of fusionnerLignes(sortie.lignes)) {
        await this.appliquer(tx, ctx, sortie.depot_id, sortie.type, {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: null,
        }, reference, sortie.motif || null, { referenceCourte });
      }
      return reference;
    });
  }

  /** Transfert inter-dépôts : sortie du dépôt source puis entrée au dépôt destination, au coût moyen source. */
  transferer(ctx: ContexteMouvement, transfert: TransfertStock): Promise<string> {
    const { reference, referenceCourte } = numerosDuBon(transfert.reference, 'TRF');
    return this.db.writeTransaction(async (tx) => {
      for (const ligne of fusionnerLignes(transfert.lignes)) {
        const source = await this.lireEtat(tx, ligne.article_id, transfert.depot_source_id);
        await this.appliquer(tx, ctx, transfert.depot_source_id, 'TRANSFERT_SORTIE', {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: null,
        }, reference, transfert.motif || null, { referenceCourte });
        await this.appliquer(tx, ctx, transfert.depot_destination_id, 'TRANSFERT_ENTREE', {
          article_id: ligne.article_id,
          quantite: ligne.quantite,
          cout_unitaire: source.cout_moyen,
        }, reference, transfert.motif || null, { referenceCourte });
      }
      return reference;
    });
  }

  /** Inventaire : la quantité comptée devient la quantité en stock ; seuls les écarts génèrent un mouvement. */
  enregistrerInventaire(ctx: ContexteMouvement, inventaire: Inventaire): Promise<{ reference: string; ecarts: number }> {
    const { reference, referenceCourte } = numerosDuBon(inventaire.reference, 'INV');
    return this.db.writeTransaction(async (tx) => {
      let ecarts = 0;
      for (const ligne of inventaire.lignes) {
        const etat = await this.lireEtat(tx, ligne.article_id, inventaire.depot_id);
        if (etat.quantite === ligne.quantite_comptee) continue;
        await this.appliquer(tx, ctx, inventaire.depot_id, 'INVENTAIRE', {
          article_id: ligne.article_id,
          quantite: ligne.quantite_comptee,
          cout_unitaire: null,
        }, reference, inventaire.motif || null, { referenceCourte });
        ecarts++;
      }
      return { reference, ecarts };
    });
  }

  /**
   * L'état d'un article dans un dépôt. Prend n'importe quel lecteur — une
   * transaction ouverte, ou la base elle-même quand on ne fait que lire
   * (`impactCorrectionEntree` renseigne un écran, il n'écrit rien).
   */
  private async lireEtat(tx: Pick<Transaction, 'getOptional'>, articleId: string, depotId: string): Promise<EtatStock & { id: string | null }> {
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
      `INSERT INTO mouvements_stock (id, article_id, depot_id, filiale_id, type, quantite, quantite_avant, quantite_apres, cout_unitaire, reference, reference_courte, motif, fournisseur_id, remise_montant, date_livraison, utilisateur_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.nouvelId(), ligne.article_id, depotId, ctx.filialeId, type,
        Math.abs(resultat.quantite), resultat.quantite_avant, resultat.quantite_apres,
        // Une sortie vaut le coût moyen du dépôt au moment où elle part. Sans
        // lui, un bon de casse ou de transfert ne dit pas ce qu'il a coûté, et
        // le coût moyen d'aujourd'hui ne le dira plus jamais exactement.
        ligne.cout_unitaire ?? resultat.cout_moyen,
        reference, options.referenceCourte ?? null, motif, options.fournisseurId ?? null, options.remiseMontant ?? 0, options.dateLivraison ?? null, ctx.utilisateurId, now,
      ],
    );
  }
}
