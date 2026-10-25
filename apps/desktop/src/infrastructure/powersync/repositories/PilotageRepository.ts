import type { Granularite } from '../../../core/pilotage';

/**
 * Les lectures du tableau de bord.
 *
 * Rien ne s'écrit ici : ce sont des requêtes, et elles ne font qu'une chose —
 * **sommer**. Marge, taux, résultat, parts et classements se déduisent dans
 * `core/pilotage`, pour que le gérant et le directeur lisent le même chiffre
 * calculé par le même code.
 *
 * ### Le coût des ventes
 *
 * Il ne vient pas des lignes de vente — elles ne portent que le prix. Il vient
 * du **journal des mouvements** : chaque `SORTIE_VENTE` garde le coût moyen que
 * le dépôt portait au moment où la marchandise est partie. Les pièces
 * antérieures à ce changement n'ont pas de coût : elles retombent sur le coût
 * moyen actuel du dépôt, faute de mieux, et c'est dit à l'écran.
 *
 * Un retour client remet de la marchandise en stock : il se retranche du coût,
 * comme son avoir se retranche du chiffre d'affaires.
 */

/** Dépenses d'exploitation : ni règlements fournisseurs, ni mouvements de trésorerie. */
const CATEGORIES_CHARGES = "('TRANSPORT','FOURNITURES','LOYER','SALAIRE','ELECTRICITE_EAU','ENTRETIEN','REPAS','AUTRE_DEPENSE')";

const COUT_SORTIES = `
  SELECT COALESCE(SUM(
    CASE WHEN m.type = 'RETOUR_CLIENT' THEN -1 ELSE 1 END
    * m.quantite * COALESCE(m.cout_unitaire, st.cout_moyen, 0)
  ), 0)
  FROM mouvements_stock m
  LEFT JOIN stocks st ON st.article_id = m.article_id AND st.depot_id = m.depot_id
  WHERE m.type IN ('SORTIE_VENTE', 'RETOUR_CLIENT')`;

/**
 * Tous les indicateurs, filiale par filiale : le gérant en lit une ligne, le
 * directeur les additionne. Les sous-requêtes bornées par la période prennent
 * `?, ?` dans l'ordre de `parametresIndicateurs`.
 */
export const INDICATEURS_QUERY = `
  SELECT f.id AS filiale_id, f.code AS filiale_code, f.nom AS filiale_nom,
    (SELECT COALESCE(SUM(v.total_net_ht), 0) FROM ventes v
      WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS ca_ht,
    (SELECT COALESCE(SUM(v.total_ttc), 0) FROM ventes v
      WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS ca_ttc,
    (SELECT COUNT(*) FROM ventes v
      WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS ventes,
    (SELECT COALESCE(SUM(v.montant_percu - v.monnaie), 0) FROM ventes v
      WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ?) AS encaisse,
    (SELECT COUNT(DISTINCT v.client_id) FROM ventes v
      WHERE v.filiale_id = f.id AND v.statut != 'ANNULEE' AND v.client_id IS NOT NULL AND v.date_vente BETWEEN ? AND ?) AS clients_servis,
    (${COUT_SORTIES} AND m.filiale_id = f.id AND m.created_at BETWEEN ? AND ?) AS cout_ventes,
    (SELECT COALESCE(SUM(t.montant), 0) FROM mouvements_tresorerie t
      WHERE t.filiale_id = f.id AND t.type = 'DEPENSE' AND t.categorie IN ${CATEGORIES_CHARGES}
        AND t.date_operation BETWEEN ? AND ?) AS charges,
    (SELECT COALESCE(SUM(CASE WHEN c.solde_actuel > 0 THEN c.solde_actuel ELSE 0 END), 0) FROM clients c
      WHERE c.filiale_id = f.id AND c.est_actif = 1) AS creances,
    (SELECT COALESCE(SUM(CASE WHEN fo.solde_actuel > 0 THEN fo.solde_actuel ELSE 0 END), 0) FROM fournisseurs fo
      WHERE fo.filiale_id = f.id AND fo.est_actif = 1) AS dettes,
    (SELECT COALESCE(SUM(s.quantite * s.cout_moyen), 0) FROM stocks s WHERE s.filiale_id = f.id AND s.quantite > 0) AS valeur_stock,
    (SELECT COALESCE(SUM(ca.solde_actuel), 0) FROM caisses ca WHERE ca.filiale_id = f.id AND ca.est_active = 1) AS tresorerie,
    -- Espèces parties d'ici et pas encore encaissées ailleurs. Comptées au
    -- départ : la somme des filiales donne le total en route, sans doublon.
    (SELECT COALESCE(SUM(tf.montant), 0) FROM transferts_filiales tf
      WHERE tf.filiale_source_id = f.id AND tf.statut = 'EN_TRANSIT') AS fonds_en_transit,
    (SELECT COUNT(*) FROM transferts_filiales tf
      WHERE tf.filiale_source_id = f.id AND tf.statut = 'EN_TRANSIT') AS transferts_en_transit,
    -- Le même argent vu de l'arrivée : ce qu'une autre filiale a envoyé ici et
    -- que personne n'a encore mis en caisse. Au groupe, cette colonne répète
    -- la précédente — elles ne s'additionnent jamais.
    (SELECT COALESCE(SUM(tf.montant), 0) FROM transferts_filiales tf
      WHERE tf.filiale_destination_id = f.id AND tf.statut = 'EN_TRANSIT') AS fonds_a_recevoir,
    (SELECT COUNT(*) FROM transferts_filiales tf
      WHERE tf.filiale_destination_id = f.id AND tf.statut = 'EN_TRANSIT') AS transferts_a_recevoir,
    (SELECT COUNT(*) FROM livraisons l
      WHERE l.filiale_id = f.id AND l.statut IN ('A_PREPARER', 'EN_COURS')) AS livraisons_attente,
    (SELECT COUNT(*) FROM livraisons l
      WHERE l.filiale_id = f.id AND l.statut IN ('A_PREPARER', 'EN_COURS')
        AND l.date_livraison_prevue IS NOT NULL AND l.date_livraison_prevue < ?) AS livraisons_retard,
    (SELECT COUNT(*) FROM commandes_fournisseurs cf
      WHERE cf.filiale_id = f.id AND cf.statut IN ('BROUILLON', 'ENVOYEE', 'PARTIELLE')) AS commandes_ouvertes
  FROM filiales f WHERE f.est_active = 1 ORDER BY f.type DESC, f.nom`;

/** Les bornes, dans l'ordre où la requête les consomme. */
export function parametresIndicateurs(debut: string, fin: string): string[] {
  return [
    debut, fin, // ca_ht
    debut, fin, // ca_ttc
    debut, fin, // ventes
    debut, fin, // encaisse
    debut, fin, // clients_servis
    debut, fin, // cout_ventes
    debut, fin, // charges
    fin,        // livraisons en retard : prévues avant la fin de la période
  ];
}

/**
 * La série de l'histogramme : une ligne par jour (ou par mois) où il s'est
 * passé quelque chose. Les cases vides sont comblées par `serieCaMarge`.
 */
export function serieQuery(granularite: Granularite): string {
  const cle = granularite === 'MOIS' ? 'substr(v.date_vente, 1, 7)' : 'substr(v.date_vente, 1, 10)';
  const cleMouvement = granularite === 'MOIS' ? 'substr(m.created_at, 1, 7)' : 'substr(m.created_at, 1, 10)';
  return `
    SELECT cle, SUM(ca_ht) AS ca_ht, SUM(cout) AS cout, SUM(ventes) AS ventes FROM (
      SELECT ${cle} AS cle, COALESCE(SUM(v.total_net_ht), 0) AS ca_ht, 0 AS cout, COUNT(*) AS ventes
      FROM ventes v
      WHERE v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ? AND (? = '' OR v.filiale_id = ?)
      GROUP BY cle
      UNION ALL
      SELECT ${cleMouvement} AS cle, 0 AS ca_ht,
        COALESCE(SUM(CASE WHEN m.type = 'RETOUR_CLIENT' THEN -1 ELSE 1 END * m.quantite * COALESCE(m.cout_unitaire, st.cout_moyen, 0)), 0) AS cout,
        0 AS ventes
      FROM mouvements_stock m
      LEFT JOIN stocks st ON st.article_id = m.article_id AND st.depot_id = m.depot_id
      WHERE m.type IN ('SORTIE_VENTE', 'RETOUR_CLIENT') AND m.created_at BETWEEN ? AND ? AND (? = '' OR m.filiale_id = ?)
      GROUP BY cle
    ) GROUP BY cle`;
}

export const parametresSerie = (debut: string, fin: string, filialeId: string | null): string[] => {
  const f = filialeId ?? '';
  return [debut, fin, f, f, debut, fin, f, f];
};

/**
 * L'état du stock, article par article et non ligne par ligne : « trois
 * articles en rupture » se compte sur la filiale entière, pas par dépôt.
 */
export const STOCK_PILOTAGE_QUERY = `
  SELECT a.id AS article_id, a.code, a.designation, a.stock_min,
    COALESCE(SUM(s.quantite), 0) AS quantite,
    COALESCE(SUM(CASE WHEN s.quantite > 0 THEN s.quantite * s.cout_moyen ELSE 0 END), 0) AS valeur,
    MAX(s.date_dernier_mouvement) AS dernier_mouvement
  FROM articles a
  LEFT JOIN stocks s ON s.article_id = a.id
  WHERE a.est_actif = 1 AND (? = '' OR a.filiale_id = ?)
  GROUP BY a.id, a.code, a.designation, a.stock_min`;

/** Chiffre d'affaires par famille d'articles : où se fait le métier. */
export const CA_PAR_FAMILLE_QUERY = `
  SELECT COALESCE(fa.nom, 'Sans famille') AS libelle,
    COALESCE(fa.id, 'sans-famille') AS cle,
    COALESCE(SUM(l.total_ht), 0) AS valeur,
    COALESCE(SUM(l.quantite), 0) AS quantite
  FROM lignes_vente l
  JOIN ventes v ON v.id = l.vente_id
  LEFT JOIN articles a ON a.id = l.article_id
  LEFT JOIN familles_articles fa ON fa.id = a.famille_id
  WHERE v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ? AND (? = '' OR v.filiale_id = ?)
  GROUP BY cle, libelle`;

/** Les factures que les clients n'ont pas soldées, avec leur date : l'ancienneté s'en déduit. */
export const FACTURES_IMPAYEES_QUERY = `
  SELECT v.id, v.numero, v.date_vente AS date, v.reste_a_payer AS reste, c.raison_sociale AS client
  FROM ventes v
  LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.statut != 'ANNULEE' AND v.reste_a_payer > 0 AND (? = '' OR v.filiale_id = ?)
  ORDER BY v.date_vente`;

/** Les clients qui font le chiffre : le haut du classement sur la période. */
export const TOP_CLIENTS_QUERY = `
  SELECT COALESCE(c.id, 'comptoir') AS cle,
    COALESCE(c.raison_sociale, 'Ventes comptoir') AS libelle,
    COALESCE(SUM(v.total_ttc), 0) AS valeur,
    COUNT(*) AS ventes
  FROM ventes v
  LEFT JOIN clients c ON c.id = v.client_id
  WHERE v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ? AND (? = '' OR v.filiale_id = ?)
  GROUP BY cle, libelle`;
