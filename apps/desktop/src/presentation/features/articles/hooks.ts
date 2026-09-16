import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { ArticleRow, DepotRow, FamilleArticleRow } from '@quinca/shared-types';
import { articleFromRow, depotFromRow, familleFromRow } from '../../../core/articles';
import { articlesQuery, type FiltresArticles } from '../../../infrastructure/powersync/repositories/ArticlesRepository';
import { DEPOTS_ACTIFS_QUERY, DEPOTS_QUERY } from '../../../infrastructure/powersync/repositories/DepotsRepository';
import { FAMILLES_ACTIVES_QUERY, FAMILLES_QUERY } from '../../../infrastructure/powersync/repositories/FamillesRepository';

/** Articles de la filiale, filtrés en SQL, mis à jour en temps réel. */
export function useArticles(filialeId: string | null, filtres: FiltresArticles = {}) {
  const { sql, params } = useMemo(
    () => articlesQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filtres est un objet littéral : on dépend de ses champs
    [filialeId, filtres.recherche, filtres.familleId, filtres.inclureInactifs],
  );
  const { data, isLoading } = useQuery<ArticleRow>(sql, params);
  const articles = useMemo(() => data.map(articleFromRow), [data]);
  return { articles, isLoading };
}

export function useFamilles(filialeId: string | null, { actives = false } = {}) {
  const { data, isLoading } = useQuery<FamilleArticleRow>(actives ? FAMILLES_ACTIVES_QUERY : FAMILLES_QUERY, [filialeId ?? '']);
  const familles = useMemo(() => data.map(familleFromRow), [data]);
  const famillesParId = useMemo(() => new Map(familles.map((f) => [f.id, f])), [familles]);
  return { familles, famillesParId, isLoading };
}

export function useDepots(filialeId: string | null, { actifs = false } = {}) {
  const { data, isLoading } = useQuery<DepotRow>(actifs ? DEPOTS_ACTIFS_QUERY : DEPOTS_QUERY, [filialeId ?? '']);
  const depots = useMemo(() => data.map(depotFromRow), [data]);
  return { depots, isLoading };
}
