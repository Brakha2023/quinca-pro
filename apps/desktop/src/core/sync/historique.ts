/**
 * Borne de l'historique gardé sur le poste.
 *
 * Chaque poste téléchargeait toute l'activité depuis l'ouverture, pour
 * toujours : une base locale qui ne fait que grossir, une première
 * synchronisation qui s'allonge à chaque année, sur des machines de caisse.
 *
 * La fenêtre est calculée **par le serveur** : une règle de synchronisation ne
 * peut pas comparer une date à « il y a douze mois » (elle doit être
 * déterministe, et un paramètre du poste ne supporte que l'égalité). Postgres
 * marque donc les lignes chaque jour — `rafraichir_fenetre_historique()`, dont
 * la durée doit rester d'accord avec la constante ci-dessous, qui sert à le
 * dire aux utilisateurs.
 */

/** Durée d'historique gardée localement. Au-delà, les pièces restent sur le serveur. */
export const MOIS_HISTORIQUE_LOCAL = 12;

/** « des 12 derniers mois », pour le dire à l'écran. */
export function libelleHistoriqueLocal(mois = MOIS_HISTORIQUE_LOCAL): string {
  return `des ${mois} derniers mois`;
}
