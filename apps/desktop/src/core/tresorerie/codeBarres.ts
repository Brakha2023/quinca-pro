/**
 * Code 39 : le symbole le plus simple à imprimer sur une imprimante de caisse
 * et à relire avec une douchette bas de gamme, sans clé de contrôle.
 *
 * Chaque caractère vaut neuf éléments alternés barre / espace, en commençant
 * et en finissant par une barre : cinq barres (positions paires) et quatre
 * espaces (positions impaires), dont exactement deux barres larges et un
 * espace large. `*` encadre le message.
 */

/** Un élément du symbole : `n` étroit, `w` large. */
type Element = 'n' | 'w';

export const CODE39_START_STOP = '*';

/** Motifs standard, barre d'abord. Les caractères spéciaux ($ / + %) sont hors jeu : nos codes sont alphanumériques. */
export const MOTIFS_CODE39: Readonly<Record<string, string>> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn', '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw', B: 'nnwnnwnnw', C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn',
  F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn', I: 'nnwnnwwnn', J: 'nnnnwwwnn',
  K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww', O: 'wnnnwnnwn',
  P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn', '-': 'nwnnnnwnw', '.': 'wwnnnnwnn', ' ': 'nwwnnnwnn',
  [CODE39_START_STOP]: 'nwnnwnwnn',
};

/** Ce que Code 39 sait coder, le reste étant remplacé par un tiret. */
export const normaliserCode39 = (texte: string): string =>
  texte
    .toUpperCase()
    .replace(/[^0-9A-Z\-. ]/g, '-')
    .slice(0, 24);

/** Une barre du symbole : position et largeur en unités étroites. */
export interface BarreCodeBarres {
  x: number;
  largeur: number;
}

export interface SymboleCodeBarres {
  /** Le texte réellement codé, start/stop exclus. */
  texte: string;
  barres: BarreCodeBarres[];
  /** Largeur totale en unités étroites, pour le `viewBox`. */
  largeur: number;
}

/**
 * Barres noires du symbole, en unités étroites (barre large = 2, espace de
 * séparation entre caractères = 1). À dessiner tel quel dans un `<svg>`.
 */
export function code39(texte: string): SymboleCodeBarres {
  const normalise = normaliserCode39(texte);
  const barres: BarreCodeBarres[] = [];
  let x = 0;
  for (const [index, caractere] of [...`${CODE39_START_STOP}${normalise}${CODE39_START_STOP}`].entries()) {
    if (index > 0) x += 1; // séparateur inter-caractères
    const motif = MOTIFS_CODE39[caractere] ?? MOTIFS_CODE39['-']!;
    for (const [position, element] of [...motif].entries()) {
      const largeur = (element as Element) === 'w' ? 2 : 1;
      if (position % 2 === 0) barres.push({ x, largeur });
      x += largeur;
    }
  }
  return { texte: normalise, barres, largeur: x };
}
