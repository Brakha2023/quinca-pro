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

/**
 * Le mouvement de stock `m` n'appartient pas à une vente annulée.
 *
 * Le chiffre d'affaires d'une vente annulée est écarté partout par
 * `statut != 'ANNULEE'` ; son coût doit l'être de la même façon, sinon il
 * reste seul. Or l'annulation vient **après** la vente et peut tomber dans un
 * autre mois : la sortie creuserait alors une perte dans le mois de la vente,
 * et le retour offrirait le même montant à celui de l'annulation. Les deux
 * mouvements se reconnaissent au numéro de la pièce, qu'ils portent en
 * référence.
 *
 * Posé ici parce que c'est ici que se définit ce que coûte la marchandise
 * vendue ; le rapport des marges s'en sert aussi, pour que les deux écrans ne
 * puissent pas diverger.
 *
 * ### Pourquoi un `NOT IN` et non un `NOT EXISTS`
 *
 * La base du poste ne porte aucun index : un `NOT EXISTS` corrélé relirait la
 * table des ventes à chaque mouvement. La liste des pièces annulées, elle, ne
 * dépend pas du mouvement — SQLite ne la calcule qu'une fois. Les deux `IS
 * NULL` ne sont pas de la prudence gratuite : un seul `numero` nul dans la
 * liste rendrait le `NOT IN` indécidable et écarterait **tout**, et un
 * mouvement sans référence — une casse, un inventaire — doit être gardé.
 *
 * Le numéro suffit à désigner la pièce : il porte le code de la caisse et un
 * suffixe tiré au sort, il ne se répète pas d'une filiale à l'autre.
 */
export const MOUVEMENT_HORS_VENTE_ANNULEE = `
  (m.reference IS NULL OR m.reference NOT IN (
    SELECT numero FROM ventes WHERE statut = 'ANNULEE' AND numero IS NOT NULL
  ))`;

const COUT_SORTIES = `
  SELECT COALESCE(SUM(
    CASE WHEN m.type = 'RETOUR_CLIENT' THEN -1 ELSE 1 END
    * m.quantite * COALESCE(m.cout_unitaire, st.cout_moyen, 0)
  ), 0)
  FROM mouvements_stock m
  LEFT JOIN stocks st ON st.article_id = m.article_id AND st.depot_id = m.depot_id
  WHERE m.type IN ('SORTIE_VENTE', 'RETOUR_CLIENT') AND ${MOUVEMENT_HORS_VENTE_ANNULEE}`;

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
    -- La marchandise sur la route : sortie d'un dépôt, entrée dans aucun. La
    -- valeur du stock ne la voit pas, elle ne compte que ce qui est en rayon.
    -- Même règle que les fonds : au départ pour le total, à l'arrivée pour
    -- celui qui doit la recevoir, et jamais les deux additionnées.
    (SELECT COALESCE(SUM(ts.valeur_totale), 0) FROM transferts_stock ts
      WHERE ts.filiale_source_id = f.id AND ts.statut = 'EN_TRANSIT') AS stock_en_transit,
    (SELECT COUNT(*) FROM transferts_stock ts
      WHERE ts.filiale_source_id = f.id AND ts.statut = 'EN_TRANSIT') AS transferts_stock_en_transit,
    (SELECT COALESCE(SUM(ts.valeur_totale), 0) FROM transferts_stock ts
      WHERE ts.filiale_destination_id = f.id AND ts.statut = 'EN_TRANSIT') AS stock_a_recevoir,
    (SELECT COUNT(*) FROM transferts_stock ts
      WHERE ts.filiale_destination_id = f.id AND ts.statut = 'EN_TRANSIT') AS transferts_stock_a_recevoir,
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
        AND ${MOUVEMENT_HORS_VENTE_ANNULEE}
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

/**
 * Les comptes les plus engagés : ceux à qui on doit le plus, ceux qui nous
 * doivent le plus.
 *
 * Le solde vient de `solde_actuel`, colonne **calculée par le serveur** à
 * partir des pièces et des règlements : il comprend le report d'ouverture
 * repris à la main lors de la bascule, que les ventes et les commandes du
 * poste ignorent. C'est le bon chiffre, c'est celui du relevé qu'on envoie au
 * client.
 *
 * Seuls les soldes **positifs** entrent, et seuls les comptes **actifs** : ce
 * sont exactement les deux filtres des tuiles « Créances clients » et « Dettes
 * fournisseurs » ci-dessus (voir `INDICATEURS_QUERY`). Il le faut — la somme
 * des lignes de la carte doit retomber sur le total de la tuile, sinon le
 * tableau de bord se contredit d'une ligne à l'autre. Un client en avance ne
 * nous doit rien, et une fiche désactivée n'est plus un dossier ouvert.
 *
 * Les deux requêtes sont jumelles, et c'est voulu : la dette et la créance se
 * lisent du même œil, et seul le sens de la phrase change.
 *
 * La filiale du tiers est rendue avec lui. En vue groupe, c'est elle qui
 * permet d'ouvrir son compte : le module Clients travaille sur une filiale, et
 * sans ce renseignement un clic depuis la consolidation ne mènerait nulle part.
 */
export const TOP_CREANCES_CLIENTS_QUERY = `
  SELECT id AS cle, raison_sociale AS libelle, code, filiale_id,
         COALESCE(solde_actuel, 0) AS valeur, date_effet_solde
  FROM clients
  WHERE COALESCE(solde_actuel, 0) > 0 AND est_actif = 1 AND (? = '' OR filiale_id = ?)
  ORDER BY valeur DESC
  LIMIT ?`;

export const TOP_DETTES_FOURNISSEURS_QUERY = `
  SELECT id AS cle, raison_sociale AS libelle, code, filiale_id,
         COALESCE(solde_actuel, 0) AS valeur, date_effet_solde
  FROM fournisseurs
  WHERE COALESCE(solde_actuel, 0) > 0 AND est_actif = 1 AND (? = '' OR filiale_id = ?)
  ORDER BY valeur DESC
  LIMIT ?`;

/**
 * L'activité d'un compte, mois par mois : facturé d'un côté, réglé de l'autre.
 *
 * Les deux moitiés sont cousues par un `UNION ALL` puis regroupées : un mois
 * où il a seulement payé, et un mois où il a seulement acheté, doivent tous
 * deux produire une barre. Une jointure les aurait fait disparaître.
 *
 * Côté client, le facturé est le **ticket toutes taxes** : c'est ce qui est
 * porté à son compte, donc ce que le réglé doit rattraper. Une vente annulée
 * n'a jamais existé pour son compte, elle est écartée.
 */
export const ACTIVITE_CLIENT_QUERY = `
  SELECT cle, SUM(facture) AS facture, SUM(regle) AS regle FROM (
    SELECT substr(v.date_vente, 1, 7) AS cle, COALESCE(v.total_ttc, 0) AS facture, 0 AS regle
      FROM ventes v
     WHERE v.client_id = ? AND v.statut != 'ANNULEE' AND v.date_vente >= ?
    UNION ALL
    SELECT substr(r.date_reglement, 1, 7) AS cle, 0 AS facture, COALESCE(r.montant, 0) AS regle
      FROM reglements_clients r
     WHERE r.client_id = ? AND r.date_reglement >= ?
  )
  GROUP BY cle`;

/**
 * La même chose pour un fournisseur, à deux différences près.
 *
 * Le facturé est le **reçu** (`total_recu_ttc`), et il est daté de la
 * réception et non de la commande : une dette naît quand la marchandise
 * arrive, pas quand on la commande — un bon envoyé il y a trois mois et jamais
 * livré ne doit pas peser sur le mois de son envoi. Les pièces annulées,
 * celles d'un bon corrigé notamment, sont écartées.
 */
export const ACTIVITE_FOURNISSEUR_QUERY = `
  SELECT cle, SUM(facture) AS facture, SUM(regle) AS regle FROM (
    SELECT substr(COALESCE(c.date_reception, c.date_commande), 1, 7) AS cle,
           COALESCE(c.total_recu_ttc, 0) AS facture, 0 AS regle
      FROM commandes_fournisseurs c
     WHERE c.fournisseur_id = ? AND c.statut != 'ANNULEE'
       AND COALESCE(c.total_recu_ttc, 0) > 0
       AND COALESCE(c.date_reception, c.date_commande) >= ?
    UNION ALL
    SELECT substr(r.date_reglement, 1, 7) AS cle, 0 AS facture, COALESCE(r.montant, 0) AS regle
      FROM reglements_fournisseurs r
     WHERE r.fournisseur_id = ? AND r.date_reglement >= ?
  )
  GROUP BY cle`;
