/**
 * Numérotation des pièces hors ligne.
 *
 * Aucun compteur central n'est possible : un poste doit pouvoir numéroter une
 * vente sans réseau. Le numéro est donc tiré au hasard, et sa seule protection
 * est le nombre de tirages possibles — un doublon tombe sur la contrainte
 * `unique (filiale_id, numero)` du serveur et la pièce est refusée.
 *
 * Deux garde-fous se multiplient :
 *   1. le code du **poste**, qui cloisonne les tirages machine par machine ;
 *   2. un suffixe de 6 caractères, soit 32⁶ ≈ 1,07 milliard de tirages par
 *      préfixe, par poste et par jour (contre 32⁴ ≈ 1 million auparavant).
 */

/** 32 caractères sans I, O, 0 ni 1 : un numéro dicté au téléphone reste lisible. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Longueur du suffixe aléatoire d'un numéro de pièce. */
export const LONGUEUR_SUFFIXE = 6;
/** Longueur du code qui identifie le poste dans un numéro de pièce. */
export const LONGUEUR_CODE_POSTE = 3;
/** Longueur du code court d'un tiers (client, fournisseur, employé). */
export const LONGUEUR_CODE_TIERS = 6;

const MOTIF_CODE_POSTE = new RegExp(`^[${ALPHABET}]{${LONGUEUR_CODE_POSTE}}$`);

function suffixeAleatoire(longueur: number): string {
  const octets = new Uint8Array(longueur);
  crypto.getRandomValues(octets);
  let s = '';
  for (const b of octets) s += ALPHABET[b % ALPHABET.length];
  return s;
}

/** Tire un code de poste : à faire une seule fois par machine, puis à mémoriser. */
export function genererCodePoste(): string {
  return suffixeAleatoire(LONGUEUR_CODE_POSTE);
}

/** Code de poste relu depuis le stockage local, ou `null` s'il est absent ou altéré. */
export function codePosteValide(valeur: unknown): string | null {
  if (typeof valeur !== 'string') return null;
  const code = valeur.trim().toUpperCase();
  return MOTIF_CODE_POSTE.test(code) ? code : null;
}

export interface PieceANumeroter {
  /** Nature de la pièce (`ENT`, `REG`, `BC`…) ou, pour une vente, le code de la caisse. */
  prefixe: string;
  /** Code du poste qui crée la pièce (voir {@link genererCodePoste}). */
  poste: string;
  date?: Date;
}

/**
 * Numéro de pièce lisible et unique hors ligne : `PREFIXE-POSTE-AAAAMMJJ-XXXXXX`,
 * par exemple `ENT-K7Q-20260922-M3Q2PT`.
 */
export function genererNumeroPiece({ prefixe, poste, date = new Date() }: PieceANumeroter): string {
  const jour = date.toISOString().slice(0, 10).replace(/-/g, '');
  // Un code de poste absent ne doit pas faire perdre la pièce : on en tire un
  // pour ce numéro-là. Il ne cloisonne plus rien, mais l'unicité tient toujours.
  const machine = codePosteValide(poste) ?? genererCodePoste();
  return `${prefixe}-${machine}-${jour}-${suffixeAleatoire(LONGUEUR_SUFFIXE)}`;
}

/** Code court pour un tiers (client, fournisseur, employé) : `PREFIXE-XXXXXX`. */
export function genererCodeTiers(prefixe: string): string {
  return `${prefixe}-${suffixeAleatoire(LONGUEUR_CODE_TIERS)}`;
}
