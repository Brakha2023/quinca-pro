/** Règles d'arrondi et de conversion de prix (FCFA : pas de centimes en pratique, on garde 2 décimales max). */

export function arrondirMontant(montant: number): number {
  return Math.round(montant * 100) / 100;
}

/** Montant encaissable : le franc CFA n'a pas de centimes, tout TTC payé est arrondi à l'unité. */
export function arrondirFcfa(montant: number): number {
  return Math.round(montant);
}

export function prixHtDepuisTtc(prixTtc: number, tauxTva: number): number {
  return arrondirMontant(prixTtc / (1 + tauxTva / 100));
}

export function prixTtcDepuisHt(prixHt: number, tauxTva: number): number {
  return arrondirMontant(prixHt * (1 + tauxTva / 100));
}

/**
 * Montant net d'une remise exprimée en pourcentage, bornée à [0, 100].
 * Une remise absente ou illisible vaut zéro : un NaN se propagerait jusqu'au
 * coût moyen du stock, où il serait irrattrapable.
 */
export function montantApresRemise(montant: number, remisePercent: number | null | undefined): number {
  const taux = Number.isFinite(remisePercent) ? Math.min(Math.max(remisePercent as number, 0), 100) : 0;
  return arrondirMontant(montant * (1 - taux / 100));
}

/**
 * Remise en % telle qu'elle se tape, ramenée dans [0, 100] dès la frappe :
 * au-delà, le total afficherait 0 F et la validation ne refuserait qu'à la fin.
 */
export const remiseSaisie = (valeur: string): number => {
  const n = Number(valeur);
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), 100) : 0;
};

/** Marge en % du prix d'achat ; 0 si le prix d'achat n'est pas renseigné. */
export function margePourcent(prixAchat: number, prixVente: number): number {
  if (prixAchat <= 0) return 0;
  return Math.round(((prixVente - prixAchat) / prixAchat) * 100);
}

/** Affichage monétaire : le franc CFA n'a pas de centimes, on arrondit à l'unité. */
/** Espace fine insécable : un groupe de milliers ne se coupe pas en fin de ligne. */
const ESPACE_MILLIERS = '\u202f';

/**
 * Groupe les milliers pendant la frappe : « 1250000 » se lit **1 250 000**.
 * Sans les groupes, un zéro de trop passe inaperçu, et c'est le genre d'erreur
 * qu'on ne retrouve qu'au comptage du soir.
 */
export function grouperMilliers(valeur: number): string {
  if (!Number.isFinite(valeur)) return '';
  const signe = valeur < 0 ? '-' : '';
  const chiffres = String(Math.abs(Math.round(valeur)));
  return signe + chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, ESPACE_MILLIERS);
}

/**
 * Lit un montant saisi : seuls les chiffres comptent, le FCFA n'ayant pas de
 * centimes. « 1 250 000 F » et « 1.250.000 » donnent donc 1250000, et une
 * saisie vide donne 0.
 */
export function lireMontant(saisie: string): number {
  const chiffres = saisie.replace(/[^\d]/g, '');
  return chiffres === '' ? 0 : Number(chiffres);
}

export function formaterFcfa(montant: number | null | undefined): string {
  return `${Math.round(montant ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F`;
}

/**
 * Montant abrégé, pour une graduation d'axe ou une étiquette qui n'a pas la
 * place : `1 250 000 F` devient `1,3 M`. Jamais sur une somme à vérifier —
 * là, c'est `formaterFcfa` et rien d'autre.
 */
export function formaterCompact(montant: number | null | undefined): string {
  const v = Math.round(montant ?? 0);
  const signe = v < 0 ? '-' : '';
  const n = Math.abs(v);
  if (n >= 1_000_000_000) return `${signe}${(n / 1_000_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Md`;
  if (n >= 1_000_000) return `${signe}${(n / 1_000_000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} M`;
  if (n >= 1_000) return `${signe}${(n / 1_000).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} k`;
  return `${signe}${n}`;
}

/** Pourcentage à la française : virgule décimale, espace avant le signe. */
export function formaterPourcentage(valeur: number | null | undefined, decimales = 1): string {
  return `${(valeur ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: decimales })} %`;
}
