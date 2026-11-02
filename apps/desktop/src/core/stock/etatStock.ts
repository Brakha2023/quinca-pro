import { arrondirMontant } from '../commun/prix';
import { statutStock, type StatutStock } from './mouvement';

/**
 * État du stock : ce que vaut ce qui est en magasin, et ce qui demande une
 * décision. Les quantités négatives existent (vente forcée par un gérant) et
 * comptent telles quelles : masquer une valeur négative masquerait l'anomalie.
 *
 * Deux valeurs, qui ne disent pas la même chose : au **coût moyen**, c'est
 * l'argent immobilisé dans le magasin — celui qu'on a sorti pour l'acheter ;
 * au **prix de vente**, c'est ce que le même stock rapporterait s'il partait
 * entièrement au prix du catalogue. L'écart entre les deux est la marge
 * potentielle, qui n'est pas un bénéfice : rien n'est encore vendu.
 */
/**
 * Libellés des états de stock du suivi. Distincts de ceux de la fiche article
 * (`core/articles`), qui répond à une autre question : ici on classe une ligne
 * de stock, là on qualifie un article.
 */
export const LIBELLES_ETAT_STOCK: Record<StatutStock, string> = {
  RUPTURE: 'Rupture',
  FAIBLE: 'Sous le minimum',
  OK: 'Normal',
  SURSTOCK: 'Au-dessus du maximum',
};

export interface LigneEtatStock {
  quantite: number | null;
  cout_moyen: number | null;
  /** Prix de vente du catalogue : ce que la ligne rapporterait une fois vendue. */
  article_prix_vente?: number | null;
  article_stock_min: number | null;
  article_stock_max: number | null;
}

/** Ce que vaut une ligne de stock : ce qu'elle a coûté, et ce qu'elle rapporterait. */
export function valeurAchat(l: LigneEtatStock): number {
  return arrondirMontant((l.quantite ?? 0) * (l.cout_moyen ?? 0));
}

export function valeurVente(l: LigneEtatStock): number {
  return arrondirMontant((l.quantite ?? 0) * (l.article_prix_vente ?? 0));
}

export interface RecapEtatStock {
  lignes: number;
  /** Valeur d'achat : les quantités au coût moyen du dépôt. C'est l'argent immobilisé. */
  valeur: number;
  /** Valeur de vente : les mêmes quantités au prix du catalogue, si tout partait au prix fort. */
  valeur_vente: number;
  /** Marge potentielle : ce que le stock rapporterait au-delà de ce qu'il a coûté. */
  marge: number;
  /** Marge en % de la valeur de vente — le taux qu'on compare d'un mois à l'autre. */
  marge_percent: number;
  ruptures: number;
  faibles: number;
  surstocks: number;
  /** Lignes dont la quantité est négative : un stock impossible, à corriger par inventaire. */
  negatifs: number;
}

export function recapEtatStock(lignes: readonly LigneEtatStock[]): RecapEtatStock {
  const statuts = lignes.map((l) => statutStock(l.quantite ?? 0, l.article_stock_min ?? 0, l.article_stock_max ?? 0));
  const compte = (s: StatutStock) => statuts.filter((x) => x === s).length;
  const valeur = arrondirMontant(lignes.reduce((t, l) => t + valeurAchat(l), 0));
  const valeur_vente = arrondirMontant(lignes.reduce((t, l) => t + valeurVente(l), 0));
  const marge = arrondirMontant(valeur_vente - valeur);
  return {
    lignes: lignes.length,
    valeur,
    valeur_vente,
    marge,
    // Sur la valeur de vente, comme une marge commerciale : c'est la part du
    // prix de vente qui n'est pas du coût. Rapportée au coût, le même stock
    // afficherait un taux plus flatteur et moins comparable.
    marge_percent: valeur_vente > 0 ? Math.round((marge / valeur_vente) * 100) : 0,
    ruptures: compte('RUPTURE'),
    faibles: compte('FAIBLE'),
    surstocks: compte('SURSTOCK'),
    negatifs: lignes.filter((l) => (l.quantite ?? 0) < 0).length,
  };
}

/** Filtres en vigueur, en une phrase. */
export function perimetreEtatStock(filtres: { depotNom?: string | null; recherche?: string; alertesSeulement?: boolean }): string {
  return [
    filtres.depotNom ? `dépôt « ${filtres.depotNom} »` : 'tous dépôts',
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
    filtres.alertesSeulement ? 'lignes en alerte seulement' : null,
  ].filter(Boolean).join(' · ');
}
