/** Règles d'arrondi et de conversion de prix (FCFA : pas de centimes en pratique, on garde 2 décimales max). */

export function arrondirMontant(montant: number): number {
  return Math.round(montant * 100) / 100;
}

export function prixHtDepuisTtc(prixTtc: number, tauxTva: number): number {
  return arrondirMontant(prixTtc / (1 + tauxTva / 100));
}

export function prixTtcDepuisHt(prixHt: number, tauxTva: number): number {
  return arrondirMontant(prixHt * (1 + tauxTva / 100));
}

/** Marge en % du prix d'achat ; 0 si le prix d'achat n'est pas renseigné. */
export function margePourcent(prixAchat: number, prixVente: number): number {
  if (prixAchat <= 0) return 0;
  return Math.round(((prixVente - prixAchat) / prixAchat) * 100);
}

/** Affichage monétaire : le franc CFA n'a pas de centimes, on arrondit à l'unité. */
export function formaterFcfa(montant: number | null | undefined): string {
  return `${Math.round(montant ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} F`;
}
