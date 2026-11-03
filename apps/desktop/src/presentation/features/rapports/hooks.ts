import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import { margesArticles, type LigneMarge, type MargeArticleRow } from '../../../core/rapports';
import { CATEGORIES_ARTICLES_QUERY, margesQuery } from '../../../infrastructure/powersync/repositories/RapportsRepository';

/**
 * Le rapport lit la base locale : il fonctionne hors ligne, et se recalcule à
 * chaque vente qui arrive. Un gérant ne voit que sa filiale — les règles de
 * synchronisation s'en chargent —, un directeur les voit toutes.
 */

/**
 * Une ligne par article vendu sur la période. Les catégories en découlent
 * (voir `margesCategories`) : c'est la même lecture qui nourrit les deux
 * tableaux, le graphique et la feuille imprimée.
 */
export function useMargesArticles(filialeId: string | null, bornes: { debut: string; fin: string }): { articles: LigneMarge[]; isLoading: boolean } {
  const { sql, params } = useMemo(() => margesQuery(filialeId, bornes), [filialeId, bornes]);
  const { data, isLoading } = useQuery<MargeArticleRow>(sql, params);
  return { articles: useMemo(() => margesArticles(data), [data]), isLoading };
}

/** Les catégories du catalogue, pour le filtre : y compris celles qui n'ont rien vendu. */
export function useCategoriesArticles(filialeId: string | null): Array<{ id: string; nom: string }> {
  const { data } = useQuery<{ id: string; nom: string }>(CATEGORIES_ARTICLES_QUERY, [filialeId ?? '', filialeId ?? '']);
  return useMemo(() => data.map((f) => ({ id: f.id, nom: f.nom ?? '' })), [data]);
}
