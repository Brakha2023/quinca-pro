/**
 * Ce qu'un bouton dit pendant qu'il travaille.
 *
 * Un clic sur « Imprimer » ouvre un aperçu de trois cents lignes ; un clic sur
 * « Exporter » construit un classeur puis attend la boîte d'enregistrement de
 * Windows ; un clic sur « Supprimer » interroge le serveur. Entre le clic et
 * le résultat, il se passe une à trois secondes pendant lesquelles rien ne
 * bougeait : le caissier recliquait, et le travail partait deux fois.
 *
 * Le bouton doit donc faire trois choses, et dans cet ordre : se **désarmer**
 * pour que le second clic ne porte pas, **le dire** pour qu'on sache que
 * quelque chose est en route, et **revenir** quoi qu'il arrive — y compris
 * quand l'opération échoue, sinon le bouton reste mort et il faut recharger.
 *
 * Ce fichier ne tient que ce qui se décide sans React : le libellé pendant
 * l'attente, et de quoi mesurer qu'un second clic a bien été ignoré.
 */

/**
 * Le libellé affiché pendant le travail.
 *
 * Le verbe passe au présent progressif de la langue de tous les jours —
 * « Impression… » plutôt que « Imprimer » — quand on connaît sa forme ;
 * autrement le libellé d'origine reste, suivi des trois points. Jamais de
 * « Chargement… » générique : il efface ce sur quoi on vient de cliquer, et
 * quand deux boutons voisins travaillent on ne sait plus lequel.
 */
const LIBELLES_ATTENTE: ReadonlyArray<readonly [RegExp, string]> = [
  [/^imprimer\b/i, 'Impression…'],
  [/^exporter\b/i, 'Export…'],
  [/^enregistrer\b/i, 'Enregistrement…'],
  [/^valider\b/i, 'Validation…'],
  [/^supprimer\b/i, 'Suppression…'],
  [/^envoyer\b/i, 'Envoi…'],
  [/^créer\b/i, 'Création…'],
  [/^encaisser\b/i, 'Encaissement…'],
  [/^payer\b/i, 'Paiement…'],
  [/^importer\b/i, 'Import…'],
];

export function libelleAttente(libelle: string): string {
  const propre = libelle.trim();
  if (!propre) return 'Un instant…';
  for (const [forme, attente] of LIBELLES_ATTENTE) {
    if (forme.test(propre)) return attente;
  }
  return `${propre}…`;
}

/**
 * Laisse le navigateur afficher ce qui vient d'être demandé avant de
 * l'occuper.
 *
 * Certains travaux ne sont pas asynchrones : ouvrir un aperçu de trois cents
 * lignes, c'est un rendu qui bloque le fil d'exécution. Demander le tourniquet
 * puis enchaîner aussitôt ne montrerait rien — le navigateur n'aurait pas eu
 * une seule occasion de peindre entre les deux. Deux trames suffisent à
 * garantir qu'un affichage a eu lieu.
 */
export const peindre = (): Promise<void> =>
  new Promise((resoudre) => {
    if (typeof requestAnimationFrame !== 'function') { resoudre(); return; }
    requestAnimationFrame(() => requestAnimationFrame(() => resoudre()));
  });
