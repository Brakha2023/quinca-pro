const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function suffixeAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  let s = '';
  for (const b of octets) s += ALPHABET[b % ALPHABET.length];
  return s;
}

/**
 * Numéro de pièce lisible et unique hors ligne : `PREFIXE-AAAAMMJJ-XXXX`.
 * Pas de compteur central : deux postes hors ligne ne peuvent pas entrer en collision.
 */
export function genererNumeroPiece(prefixe: string, date: Date = new Date()): string {
  const jour = date.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefixe}-${jour}-${suffixeAleatoire(4)}`;
}

/** Code court pour un tiers (client, fournisseur) : `PREFIXE-XXXXX`. */
export function genererCodeTiers(prefixe: string): string {
  return `${prefixe}-${suffixeAleatoire(5)}`;
}
