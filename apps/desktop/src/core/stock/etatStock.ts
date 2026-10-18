import { arrondirMontant } from '../commun/prix';
import { statutStock, type StatutStock } from './mouvement';

/**
 * État du stock : ce que vaut ce qui est en magasin, et ce qui demande une
 * décision. Les quantités négatives existent (vente forcée par un gérant) et
 * comptent telles quelles : masquer une valeur négative masquerait l'anomalie.
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
  article_stock_min: number | null;
  article_stock_max: number | null;
}

export interface RecapEtatStock {
  lignes: number;
  valeur: number;
  ruptures: number;
  faibles: number;
  surstocks: number;
  /** Lignes dont la quantité est négative : un stock impossible, à corriger par inventaire. */
  negatifs: number;
}

export function recapEtatStock(lignes: readonly LigneEtatStock[]): RecapEtatStock {
  const statuts = lignes.map((l) => statutStock(l.quantite ?? 0, l.article_stock_min ?? 0, l.article_stock_max ?? 0));
  const compte = (s: StatutStock) => statuts.filter((x) => x === s).length;
  return {
    lignes: lignes.length,
    valeur: arrondirMontant(lignes.reduce((t, l) => t + (l.quantite ?? 0) * (l.cout_moyen ?? 0), 0)),
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
