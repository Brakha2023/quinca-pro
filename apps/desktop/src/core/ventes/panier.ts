import { arrondirMontant, prixHtDepuisTtc } from '../commun/prix';

/** Ligne du ticket en cours. Les prix sont TTC (affichage caisse) ; le HT est dérivé. */
export interface LignePanier {
  article_id: string;
  code: string;
  designation: string;
  unite: string;
  prix_unitaire_ttc: number;
  tva_percent: number;
  quantite: number;
  remise_percent: number;
}

export interface LigneCalculee extends LignePanier {
  prix_unitaire_ht: number;
  total_ttc: number;
  total_ht: number;
}

export interface TotauxPanier {
  total_brut_ht: number;
  total_remise: number;
  total_net_ht: number;
  total_tva: number;
  total_ttc: number;
  nombre_articles: number;
}

export function calculerLigne(ligne: LignePanier): LigneCalculee {
  const facteurRemise = 1 - ligne.remise_percent / 100;
  const total_ttc = arrondirMontant(ligne.prix_unitaire_ttc * ligne.quantite * facteurRemise);
  return {
    ...ligne,
    prix_unitaire_ht: prixHtDepuisTtc(ligne.prix_unitaire_ttc, ligne.tva_percent),
    total_ttc,
    total_ht: prixHtDepuisTtc(total_ttc, ligne.tva_percent),
  };
}

/**
 * Totaux du ticket. La remise globale (en %) s'applique après les remises de ligne.
 * La TVA est calculée ligne par ligne (taux différents possibles) puis remisée au prorata.
 */
export function calculerTotaux(lignes: LignePanier[], remiseGlobalePercent = 0): TotauxPanier {
  const calculees = lignes.map(calculerLigne);
  const brutHt = calculees.reduce((s, l) => s + prixHtDepuisTtc(l.prix_unitaire_ttc * l.quantite, l.tva_percent), 0);
  const ttcApresRemisesLignes = calculees.reduce((s, l) => s + l.total_ttc, 0);
  const htApresRemisesLignes = calculees.reduce((s, l) => s + l.total_ht, 0);
  const facteurGlobal = 1 - Math.min(Math.max(remiseGlobalePercent, 0), 100) / 100;

  const total_ttc = arrondirMontant(ttcApresRemisesLignes * facteurGlobal);
  const total_net_ht = arrondirMontant(htApresRemisesLignes * facteurGlobal);
  return {
    total_brut_ht: arrondirMontant(brutHt),
    total_remise: arrondirMontant(brutHt - total_net_ht),
    total_net_ht,
    total_tva: arrondirMontant(total_ttc - total_net_ht),
    total_ttc,
    nombre_articles: lignes.reduce((s, l) => s + l.quantite, 0),
  };
}

export function ajouterAuPanier(lignes: LignePanier[], nouvelle: LignePanier): LignePanier[] {
  const existante = lignes.find((l) => l.article_id === nouvelle.article_id);
  if (!existante) return [...lignes, nouvelle];
  return lignes.map((l) => (l.article_id === nouvelle.article_id ? { ...l, quantite: l.quantite + nouvelle.quantite } : l));
}
