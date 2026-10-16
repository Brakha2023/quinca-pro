/**
 * Colonnes que Postgres calcule lui-même à partir des journaux (voir la
 * migration `cumuls_serveur`). Le poste continue de les tenir à jour dans sa
 * base locale — l'écran doit réagir immédiatement, et la vente hors ligne doit
 * pouvoir contrôler le disponible — mais il ne les **envoie** pas : deux postes
 * qui enverraient chacun leur valeur absolue s'écraseraient l'un l'autre.
 *
 * La valeur du serveur redescend ensuite et remplace la projection locale.
 */
export const COLONNES_CALCULEES_SERVEUR: Record<string, readonly string[]> = {
  stocks: ['quantite', 'quantite_disponible', 'cout_moyen', 'date_dernier_mouvement'],
  caisses: ['solde_actuel'],
};

/**
 * Retire d'une opération les colonnes calculées par le serveur.
 *
 * Rend `null` quand il ne reste plus rien à envoyer : l'opération ne portait
 * que des cumuls, le journal correspondant suffit au serveur.
 */
export function sansCumulsServeur(
  table: string,
  donnees: Record<string, unknown> | undefined,
): Record<string, unknown> | null {
  const calculees = COLONNES_CALCULEES_SERVEUR[table];
  if (!calculees) return donnees ?? {};

  const restantes = Object.fromEntries(
    Object.entries(donnees ?? {}).filter(([colonne]) => !calculees.includes(colonne)),
  );
  return Object.keys(restantes).length === 0 ? null : restantes;
}
