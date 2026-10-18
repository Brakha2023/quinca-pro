/**
 * Borne de l'historique gardé sur le poste.
 *
 * Chaque poste téléchargeait toute l'activité depuis l'ouverture, pour
 * toujours : une base locale qui ne fait que grossir, une première
 * synchronisation qui s'allonge à chaque année, sur des machines de caisse.
 *
 * Les règles de synchronisation n'ont pas de `now()` — elles doivent être
 * déterministes. C'est donc le poste qui envoie la borne à la connexion, et le
 * serveur filtre avec. La borne est le **premier jour du mois** : elle ne
 * change qu'une fois par mois, et chaque changement refait les paquets côté
 * serveur (une valeur recalculée chaque jour ferait retélécharger l'historique
 * tous les jours).
 */

/** Durée d'historique gardée localement. Au-delà, les pièces restent sur le serveur. */
export const MOIS_HISTORIQUE_LOCAL = 12;

/**
 * Date à partir de laquelle le poste garde l'activité, en ISO.
 * La Côte d'Ivoire est à UTC+0 : le premier du mois local est aussi le premier
 * du mois UTC, pas de décalage à prévoir.
 */
export function debutHistoriqueLocal(maintenant = new Date(), mois = MOIS_HISTORIQUE_LOCAL): string {
  const debut = new Date(Date.UTC(maintenant.getUTCFullYear(), maintenant.getUTCMonth() - mois, 1, 0, 0, 0, 0));
  return debut.toISOString();
}

const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « depuis novembre 2025 », pour le dire à l'écran. */
export function libelleHistoriqueLocal(depuis = debutHistoriqueLocal()): string {
  const d = new Date(depuis);
  return `depuis ${MOIS_FR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
