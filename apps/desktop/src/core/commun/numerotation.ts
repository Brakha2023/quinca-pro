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

/** Chiffres du compteur dans un numéro court : 999 999 pièces par poste et par nature. */
export const LONGUEUR_SEQUENCE = 6;

export interface PieceANumeroterCourt {
  /** Nature de la pièce (`VNT`, `ENT`, `LIV`…). */
  prefixe: string;
  /** Code du poste qui crée la pièce (voir {@link genererCodePoste}). */
  poste: string;
  /** Rang de la pièce sur ce poste, pour ce préfixe. Commence à 1. */
  sequence: number;
}

/**
 * Numéro **court** d'une pièce : `PREFIXE-POSTE-NNNNNN`, par exemple
 * `VNT-AN8-000075`.
 *
 * Il ne remplace pas {@link genererNumeroPiece} : le numéro long reste
 * l'identité de la pièce, celle que porte le code-barres et sur laquelle le
 * serveur garantit l'unicité. Le court est celui qu'on lit, qu'on dicte au
 * téléphone et qu'on cherche dans un classeur.
 *
 * Le compteur est **propre au poste**, et c'est le code du poste qui le rend
 * unique. Un compteur par filiale serait plus joli — `VNT-000075` tout court —
 * mais il ne peut pas être attribué hors ligne : deux caisses qui vendent au
 * même moment, sans réseau, tireraient toutes les deux le 76. Le code du
 * poste est le seul cloisonnement qui tienne sans serveur.
 *
 * Si le compteur venait à repartir de zéro (stockage local effacé), deux
 * pièces du même poste pourraient porter le même numéro court. C'est une gêne
 * de lecture, jamais une perte : l'identité, elle, reste le numéro long.
 */
export function formaterNumeroCourt({ prefixe, poste, sequence }: PieceANumeroterCourt): string {
  const machine = codePosteValide(poste) ?? genererCodePoste();
  return `${prefixe}-${machine}-${String(Math.max(1, Math.trunc(sequence))).padStart(LONGUEUR_SEQUENCE, '0')}`;
}
