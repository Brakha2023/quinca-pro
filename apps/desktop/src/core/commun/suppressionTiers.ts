/**
 * Supprimer un tiers — ou le désactiver.
 *
 * Même règle que pour un article (voir `core/articles/suppression`) : un
 * client ou un fournisseur qui a servi ne s'efface pas. Ses ventes, ses
 * règlements et ses pièces le nomment encore, et le serveur refuserait
 * d'ailleurs l'effacement (clés étrangères). Pour celui-là, le bon geste est
 * de le **désactiver** : il quitte les écrans de saisie, son histoire reste.
 *
 * Reste le cas d'une fiche créée en double, mal orthographiée, ou saisie pour
 * un client de passage qui n'est jamais revenu : celle-là encombre le
 * répertoire sans rien raconter, et s'efface.
 *
 * Deux gardes propres aux tiers, que l'article n'a pas :
 *
 * - **un compte qui porte de l'argent ne s'efface pas**, même sans pièce sur
 *   le poste : un solde initial, c'est une dette ou une créance reprise à la
 *   main lors de la mise en route, et l'effacer la ferait disparaître des
 *   comptes sans écriture ;
 * - les cumuls sont tenus par le serveur (voir la migration `cumuls_tiers`) :
 *   s'ils ne sont pas à zéro, des pièces existent, même hors de la fenêtre de
 *   douze mois du poste.
 */

/** Compte d'un tiers, tel que sa fiche le porte. */
export interface CompteTiers {
  solde_initial: number;
  cumul_factures: number;
  cumul_reglements: number;
}

/** Vrai dès que le compte porte de l'argent : ouverture, facture ou règlement. */
export function compteMouvemente(c: CompteTiers): boolean {
  return c.solde_initial !== 0 || c.cumul_factures !== 0 || c.cumul_reglements !== 0;
}

/**
 * Ce qui retient le tiers, dit en clair et dans l'ordre où on le dit : ce qui
 * parle le plus d'abord. Vide : rien ne le retient.
 */
export function resumeAttaches<U extends object>(
  libelles: ReadonlyArray<readonly [keyof U, (n: number) => string]>,
  usages: U,
): string[] {
  const nombre = (clef: keyof U) => Number(usages[clef] ?? 0);
  return libelles.filter(([clef]) => nombre(clef) > 0).map(([clef, dire]) => dire(nombre(clef)));
}

/**
 * Le message de refus, commun aux deux répertoires : il dit quoi faire, pas
 * seulement non. `null` quand rien ne retient le tiers.
 */
export function motifNonSupprimableTiers(
  quoi: 'Le client' | 'Le fournisseur',
  nom: string,
  compte: CompteTiers,
  attaches: readonly string[],
): string | null {
  if (attaches.length > 0) {
    return `${quoi} ${nom} a déjà servi (${attaches.join(', ')}) : le supprimer effacerait cette trace. Désactivez-le — il quitte les écrans de saisie, son histoire reste.`;
  }
  if (compteMouvemente(compte)) {
    return `${quoi} ${nom} porte un compte mouvementé (solde d'ouverture ou cumuls non nuls) : soldez-le d'abord, ou désactivez la fiche.`;
  }
  return null;
}
