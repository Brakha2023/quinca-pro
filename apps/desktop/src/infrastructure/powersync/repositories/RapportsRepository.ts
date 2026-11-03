/**
 * La lecture du rapport des marges.
 *
 * Rien ne s'écrit ici. Une seule requête, qui rend **une ligne par article
 * vendu** sur la période ; les catégories se regroupent ensuite dans
 * `core/rapports`, à partir de ces mêmes lignes. Deux requêtes — une par
 * catégorie, une par article — finiraient par ne plus dire la même chose, et
 * un rapport dont les deux tableaux se contredisent ne sert plus à rien.
 *
 * ### Deux sources, un seul article
 *
 * Le chiffre d'affaires vient des **lignes de vente**, le coût d'achat vient
 * du **journal des mouvements** : deux tables, réunies par `UNION ALL` puis
 * sommées par article. C'est la même mécanique que l'histogramme du tableau de
 * bord, et pour la même raison — aucune des deux tables ne porte les deux
 * chiffres.
 *
 * Les deux branches désignent l'article par le **catalogue** (`articles.code`,
 * `articles.designation`), pas par ce qu'en gardait la ligne de vente : un
 * article renommé depuis la vente donnerait sinon deux lignes dans le rapport
 * — son chiffre d'affaires sous l'ancien nom, son coût sous le nouveau. La
 * désignation de la ligne ne sert que de secours, quand l'article a quitté le
 * catalogue.
 *
 * ### La remise de la vente, répartie
 *
 * `lignes_vente.total_ht` ignore la remise : elle se négocie **en francs sur
 * la vente entière** (voir `core/ventes/panier`) et n'est pas redescendue dans
 * les lignes. Prise telle quelle, elle gonflerait la marge de tout ce que le
 * comptoir a consenti. Chaque ligne porte donc sa part du net réel de la
 * vente, au prorata de son hors-taxes : la somme des articles redonne
 * exactement `ventes.total_net_ht`, donc exactement le chiffre d'affaires du
 * tableau de bord.
 *
 * ### Les bornes de la période
 *
 * Le chiffre d'affaires est borné par `date_vente`, le coût par le
 * `created_at` du mouvement — les deux sont écrits dans la même transaction,
 * au même instant. C'est la convention du tableau de bord, et elle est
 * reprise ici pour que les deux écrans affichent le même total.
 *
 * Une exception : l'annulation. Elle intervient **après**, et peut tomber dans
 * un autre mois que la vente. Les mouvements d'une vente annulée sont donc
 * écartés par leur numéro de pièce, sortie et retour ensemble ; voir le
 * commentaire de la branche du coût.
 */

import { MOUVEMENT_HORS_VENTE_ANNULEE } from './PilotageRepository';

/** Sorties qui consomment du stock vendu, et les retours qui l'annulent. */
const TYPES_VENTE = "('SORTIE_VENTE', 'RETOUR_CLIENT')";

export interface FiltresMargesQuery {
  /** Bornes ISO complètes, prêtes pour `BETWEEN`. */
  debut: string;
  fin: string;
}

/**
 * Une ligne par article vendu : son chiffre d'affaires net, son coût d'achat,
 * sa quantité, sa catégorie.
 *
 * `filialeId` nul vaut « tout ce que ce poste reçoit » : un directeur lit
 * ainsi le groupe, un gérant sa filiale, par la même requête.
 */
export function margesQuery(filialeId: string | null, filtres: FiltresMargesQuery) {
  const f = filialeId ?? '';
  return {
    sql: `
      SELECT cle,
        MAX(code) AS code, MAX(designation) AS designation, MAX(unite) AS unite,
        MAX(famille_cle) AS famille_cle, MAX(famille) AS famille,
        COALESCE(SUM(ca_ht), 0) AS ca_ht,
        COALESCE(SUM(cout), 0) AS cout,
        COALESCE(SUM(quantite), 0) AS quantite,
        COALESCE(SUM(lignes), 0) AS lignes,
        COALESCE(SUM(sans_cout), 0) AS sorties_sans_cout
      FROM (
        -- Ce qui s'est vendu : le hors-taxes de la ligne, ramené au net de la
        -- vente. Le facteur vaut 1 quand aucune remise n'a été accordée.
        SELECT
          COALESCE(l.article_id, l.code_article, 'inconnu') AS cle,
          COALESCE(a.code, l.code_article) AS code,
          COALESCE(a.designation, l.designation) AS designation,
          a.unite AS unite,
          COALESCE(fa.id, 'sans-categorie') AS famille_cle,
          COALESCE(fa.nom, 'Sans catégorie') AS famille,
          l.total_ht * COALESCE(v.total_net_ht / NULLIF(t.ht_lignes, 0), 1) AS ca_ht,
          0 AS cout,
          l.quantite AS quantite,
          1 AS lignes,
          0 AS sans_cout
        FROM lignes_vente l
        JOIN ventes v ON v.id = l.vente_id
        JOIN (SELECT vente_id, SUM(total_ht) AS ht_lignes FROM lignes_vente GROUP BY vente_id) t
          ON t.vente_id = l.vente_id
        LEFT JOIN articles a ON a.id = l.article_id
        LEFT JOIN familles_articles fa ON fa.id = a.famille_id
        WHERE v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ? AND (? = '' OR v.filiale_id = ?)

        UNION ALL

        -- Ce que cette marchandise a coûté : le coût que le dépôt portait au
        -- départ. Un retour client remet du stock : il se retranche.
        SELECT
          COALESCE(m.article_id, 'inconnu') AS cle,
          a.code AS code,
          a.designation AS designation,
          a.unite AS unite,
          COALESCE(fa.id, 'sans-categorie') AS famille_cle,
          COALESCE(fa.nom, 'Sans catégorie') AS famille,
          0 AS ca_ht,
          CASE WHEN m.type = 'RETOUR_CLIENT' THEN -1 ELSE 1 END
            * m.quantite * COALESCE(m.cout_unitaire, st.cout_moyen, 0) AS cout,
          0 AS quantite,
          0 AS lignes,
          CASE WHEN m.cout_unitaire IS NULL THEN 1 ELSE 0 END AS sans_cout
        FROM mouvements_stock m
        LEFT JOIN stocks st ON st.article_id = m.article_id AND st.depot_id = m.depot_id
        LEFT JOIN articles a ON a.id = m.article_id
        LEFT JOIN familles_articles fa ON fa.id = a.famille_id
        WHERE m.type IN ${TYPES_VENTE} AND m.created_at BETWEEN ? AND ? AND (? = '' OR m.filiale_id = ?)
          -- Une vente annulée ne pèse dans aucun mois : règle commune au
          -- tableau de bord, d'où elle est reprise telle quelle.
          AND ${MOUVEMENT_HORS_VENTE_ANNULEE}
      )
      GROUP BY cle
      ORDER BY designation`,
    params: [filtres.debut, filtres.fin, f, f, filtres.debut, filtres.fin, f, f],
  };
}

/** Les catégories de la filiale, pour le filtre : toutes, même celles qui n'ont rien vendu. */
export const CATEGORIES_ARTICLES_QUERY = `
  SELECT id, nom FROM familles_articles
  WHERE est_active = 1 AND (? = '' OR filiale_id = ?)
  ORDER BY nom`;
