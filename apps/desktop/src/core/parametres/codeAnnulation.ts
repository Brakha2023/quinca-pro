/**
 * Le code que le gérant donne pour autoriser l'annulation d'une vente.
 *
 * Six caractères, lettres et chiffres, qu'on dicte à voix haute par-dessus le
 * comptoir : il se tape en majuscules et les espaces de la frappe sont
 * ignorés. Il n'est pas confidentiel au sens d'un mot de passe — il est
 * *partagé*, et c'est le but : la personne qui annule doit l'avoir demandé à
 * quelqu'un. Ce qui compte, c'est qu'il ne se trouve pas tout seul.
 *
 * Le code lui-même n'est jamais stocké : la filiale ne garde qu'une empreinte
 * (voir la migration `20261030000000_code_annulation.sql`).
 */

export const LONGUEUR_CODE_ANNULATION = 6;

/** Ce qu'on compare : majuscules, sans espaces ni tirets de dictée. */
export function normaliserCodeAnnulation(saisi: string): string {
  return saisi.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, LONGUEUR_CODE_ANNULATION);
}

/**
 * Pourquoi ce code ne convient pas — ou `null` s'il convient. Le message est
 * celui qu'on montre au gérant qui le choisit.
 */
export function motifCodeInvalide(saisi: string): string | null {
  const code = normaliserCodeAnnulation(saisi);
  if (code.length < LONGUEUR_CODE_ANNULATION) {
    return `Le code fait ${LONGUEUR_CODE_ANNULATION} caractères : lettres et chiffres.`;
  }
  if (/^(.)\1+$/.test(code)) return 'Un code tout en même caractère se devine : prenez-en un autre.';
  return null;
}

/** Vrai quand la filiale a un code — sans lui, aucune vente ne s'annule. */
export const codeAnnulationDefini = (empreinte: string | null | undefined): boolean =>
  typeof empreinte === 'string' && empreinte.length > 0;
