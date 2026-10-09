const UNITES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix',
  'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
const DIZAINES = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante', 'quatre-vingt', 'quatre-vingt'];

/** 0 à 99, orthographe française (soixante-dix, quatre-vingt-un…). */
function sousCent(n: number): string {
  if (n < 20) return UNITES[n]!;
  const dizaine = Math.floor(n / 10);
  const unite = n % 10;
  const base = DIZAINES[dizaine]!;
  // 70 et 90 se disent « soixante-dix » et « quatre-vingt-dix » : on repart de 10.
  // 71 garde la conjonction (« soixante et onze »), 91 ne la prend pas.
  if (dizaine === 7) return unite === 1 ? `${base} et ${UNITES[11]}` : `${base}-${UNITES[10 + unite]}`;
  if (dizaine === 9) return `${base}-${UNITES[10 + unite]}`;
  if (unite === 0) return dizaine === 8 ? `${base}s` : base;
  if (unite === 1 && dizaine !== 8) return `${base} et un`;
  return `${base}-${UNITES[unite]}`;
}

/** 0 à 999. */
function sousMille(n: number): string {
  const centaines = Math.floor(n / 100);
  const reste = n % 100;
  if (centaines === 0) return sousCent(reste);
  const tete = centaines === 1 ? 'cent' : `${UNITES[centaines]} cent`;
  // « cent » prend un s quand il termine le nombre et qu'il est multiplié.
  if (reste === 0) return centaines === 1 ? tete : `${tete}s`;
  return `${tete} ${sousCent(reste)}`;
}

const ECHELLES: Array<{ valeur: number; singulier: string; pluriel: string }> = [
  { valeur: 1_000_000_000, singulier: 'milliard', pluriel: 'milliards' },
  { valeur: 1_000_000, singulier: 'million', pluriel: 'millions' },
  { valeur: 1_000, singulier: 'mille', pluriel: 'mille' },
];

/**
 * Montant en toutes lettres, pour les reçus et les chèques : le FCFA n'ayant
 * pas de subdivision en usage, le montant est arrondi à l'unité.
 *
 * @example montantEnLettres(375500) // « trois cent soixante-quinze mille cinq cents »
 */
export function montantEnLettres(montant: number): string {
  const entier = Math.round(Math.abs(montant));
  if (entier === 0) return 'zéro';
  const morceaux: string[] = [];
  let reste = entier;
  for (const { valeur, singulier, pluriel } of ECHELLES) {
    const quotient = Math.floor(reste / valeur);
    if (quotient === 0) continue;
    reste %= valeur;
    // « mille » est invariable et ne s'écrit pas « un mille ».
    if (valeur === 1_000) morceaux.push(quotient === 1 ? singulier : `${sousMille(quotient)} ${singulier}`);
    else morceaux.push(`${sousMille(quotient)} ${quotient === 1 ? singulier : pluriel}`);
  }
  if (reste > 0) morceaux.push(sousMille(reste));
  const lettres = morceaux.join(' ');
  return montant < 0 ? `moins ${lettres}` : lettres;
}

/** Montant en lettres suivi de la devise, prêt à imprimer sur un reçu. */
export const montantEnLettresFcfa = (montant: number): string => `${montantEnLettres(montant)} franc${Math.round(Math.abs(montant)) > 1 ? 's' : ''} CFA`;
