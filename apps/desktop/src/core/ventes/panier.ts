import { arrondirFcfa, arrondirMontant, prixHtDepuisTtc } from '../commun/prix';

/**
 * Ligne du ticket en cours. Les prix sont TTC (affichage caisse) ; le HT est dérivé.
 * Les totaux TTC sont arrondis au franc (pas de centimes en FCFA) pour que le
 * montant affiché soit exactement celui exigé à l'encaissement.
 */
export interface LignePanier {
  article_id: string;
  code: string;
  designation: string;
  unite: string;
  prix_unitaire_ttc: number;
  tva_percent: number;
  quantite: number;
  /**
   * Remise de ligne, en pourcentage. Le comptoir ne la saisit plus — la remise
   * s'accorde sur la vente entière, en francs — mais une proforma reprise au
   * point de vente en porte, et la colonne existe en base : elle reste donc
   * calculée.
   */
  remise_percent: number;
}

export interface LigneCalculee extends LignePanier {
  prix_unitaire_ht: number;
  total_ttc: number;
  total_ht: number;
}

export interface TotauxPanier {
  total_brut_ht: number;
  /** Ce que le client économise au total, **toutes taxes** : remises de ligne comprises. */
  total_remise: number;
  total_net_ht: number;
  total_tva: number;
  total_ttc: number;
  nombre_articles: number;
  /** Remise de la vente réellement accordée, après plafonnement au total du ticket. */
  remise_accordee: number;
}

export function calculerLigne(ligne: LignePanier): LigneCalculee {
  const facteurRemise = 1 - ligne.remise_percent / 100;
  const total_ttc = arrondirFcfa(ligne.prix_unitaire_ttc * ligne.quantite * facteurRemise);
  return {
    ...ligne,
    prix_unitaire_ht: prixHtDepuisTtc(ligne.prix_unitaire_ttc, ligne.tva_percent),
    total_ttc,
    total_ht: prixHtDepuisTtc(total_ttc, ligne.tva_percent),
  };
}

/**
 * Totaux du ticket.
 *
 * La remise est un **montant en francs**, retranché du total toutes taxes, et
 * elle porte sur la **vente entière**. C'est ainsi qu'elle se négocie au
 * comptoir — « je te fais 5 000 » —, et non en pourcentage d'un prix que
 * personne ne calcule de tête devant le client. Une remise par article
 * obligerait d'ailleurs le caissier à ventiler à la main ce qu'il vient
 * d'accorder d'un mot.
 *
 * Elle ne dépasse jamais le ticket : on ne rend pas d'argent sur une vente.
 * Au-delà, elle est ramenée au total, et `remise_accordee` dit ce qui a
 * réellement été consenti.
 *
 * La TVA suit ce qui est payé : la remise se répartit au prorata du TTC de
 * chaque ligne, les taux pouvant différer d'un article à l'autre.
 */
export function calculerTotaux(lignes: LignePanier[], remise = 0): TotauxPanier {
  const calculees = lignes.map(calculerLigne);
  const brutTtc = calculees.reduce((s, l) => s + arrondirFcfa(l.prix_unitaire_ttc * l.quantite), 0);
  const brutHt = calculees.reduce((s, l) => s + prixHtDepuisTtc(l.prix_unitaire_ttc * l.quantite, l.tva_percent), 0);
  const ttcLignes = calculees.reduce((s, l) => s + l.total_ttc, 0);
  const htLignes = calculees.reduce((s, l) => s + l.total_ht, 0);

  const remise_accordee = arrondirFcfa(Math.min(Math.max(remise, 0), ttcLignes));
  const total_ttc = arrondirFcfa(ttcLignes - remise_accordee);
  const part = ttcLignes > 0 ? total_ttc / ttcLignes : 0;
  const total_net_ht = arrondirMontant(htLignes * part);

  return {
    total_brut_ht: arrondirMontant(brutHt),
    total_remise: arrondirFcfa(brutTtc - total_ttc),
    total_net_ht,
    total_tva: arrondirMontant(total_ttc - total_net_ht),
    total_ttc,
    nombre_articles: lignes.reduce((s, l) => s + l.quantite, 0),
    remise_accordee,
  };
}

/**
 * Remise commerciale d'un client, convertie en francs sur le ticket courant.
 *
 * Le taux reste attaché au client — c'est une condition négociée une fois —,
 * mais le comptoir ne manipule que des montants : le taux sert à proposer une
 * somme, que le caissier peut corriger.
 */
export function remiseCommerciale(lignes: LignePanier[], tauxPercent: number): number {
  if (!(tauxPercent > 0)) return 0;
  const ttc = lignes.map(calculerLigne).reduce((s, l) => s + l.total_ttc, 0);
  return arrondirFcfa((ttc * Math.min(tauxPercent, 100)) / 100);
}

export function ajouterAuPanier(lignes: LignePanier[], nouvelle: LignePanier): LignePanier[] {
  const existante = lignes.find((l) => l.article_id === nouvelle.article_id);
  if (!existante) return [...lignes, nouvelle];
  return lignes.map((l) => (l.article_id === nouvelle.article_id ? { ...l, quantite: l.quantite + nouvelle.quantite } : l));
}
