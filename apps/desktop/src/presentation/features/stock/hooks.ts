import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { MouvementStockRow, TypeMouvementStock } from '@quinca/shared-types';
import { construireBon } from '../../../core/stock';
import {
  mouvementsQuery,
  stocksParArticleQuery,
  stocksQuery,
  type FiltresMouvements,
  type FiltresStock,
  type StockVueRow,
} from '../../../infrastructure/powersync/repositories/StockRepository';

export interface StockParArticle {
  article_id: string;
  code: string;
  designation: string;
  unite: string;
  prix_achat: number;
  stock_min: number;
  stock_max: number;
  quantite: number;
  valeur: number;
}

export interface MouvementVue extends MouvementStockRow {
  article_code: string | null;
  article_designation: string | null;
  article_unite: string | null;
  depot_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
  fournisseur_nom: string | null;
}

export function useStocks(filialeId: string | null, filtres: FiltresStock = {}) {
  const { sql, params } = useMemo(
    () => stocksQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.depotId, filtres.recherche, filtres.alertesSeulement],
  );
  const { data, isLoading } = useQuery<StockVueRow>(sql, params);
  return { stocks: data, isLoading };
}

export function useStocksParArticle(filialeId: string | null) {
  const { sql, params } = useMemo(() => stocksParArticleQuery(filialeId), [filialeId]);
  const { data, isLoading } = useQuery<StockParArticle>(sql, params);
  return { lignes: data, isLoading };
}

export function useMouvements(filialeId: string | null, filtres: FiltresMouvements = {}) {
  const { sql, params } = useMemo(
    () => mouvementsQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.depotId, filtres.articleId, filtres.fournisseurId, filtres.type, filtres.reference, filtres.limite],
  );
  const { data, isLoading } = useQuery<MouvementVue>(sql, params);
  return { mouvements: data, isLoading };
}

/** Quantité en stock d'un article dans un dépôt (0 si aucune ligne). */
export function useStockArticleDepot(articleId: string | null, depotId: string | null) {
  const { data } = useQuery<{ quantite: number; quantite_disponible: number; cout_moyen: number }>(
    'SELECT quantite, quantite_disponible, cout_moyen FROM stocks WHERE article_id = ? AND depot_id = ?',
    [articleId ?? '', depotId ?? ''],
  );
  return data[0] ?? { quantite: 0, quantite_disponible: 0, cout_moyen: 0 };
}

/** Bon imprimable : tous les mouvements portant la même référence, remis en forme. */
export function useBonStock(filialeId: string | null, reference: string | null) {
  const { sql, params } = useMemo(
    () => mouvementsQuery(filialeId, { reference, limite: 500 }),
    [filialeId, reference],
  );
  const { data } = useQuery<MouvementVue>(sql, params);
  return useMemo(
    () =>
      reference
        ? construireBon(
            reference,
            data.map((m) => ({
              id: m.id,
              type: (m.type ?? 'AJUSTEMENT') as TypeMouvementStock,
              article_code: m.article_code ?? '',
              article_designation: m.article_designation ?? '',
              article_unite: m.article_unite ?? '',
              depot_nom: m.depot_nom ?? '',
              quantite: m.quantite ?? 0,
              quantite_avant: m.quantite_avant ?? 0,
              quantite_apres: m.quantite_apres ?? 0,
              cout_unitaire: m.cout_unitaire,
              remise_percent: m.remise_percent ?? 0,
              motif: m.motif,
              fournisseur_nom: m.fournisseur_nom,
              utilisateur: [m.utilisateur_prenom, m.utilisateur_nom].filter(Boolean).join(' '),
              created_at: m.created_at ?? '',
            })),
          )
        : null,
    [reference, data],
  );
}
