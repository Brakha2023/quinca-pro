import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { ArticleRow, DepotRow, FamilleArticleRow } from '@quinca/shared-types';
import {
  VENTES_VIDES,
  articleFromRow,
  depotFromRow,
  familleFromRow,
  totauxStock,
  type StockDepot,
  type VentesArticle,
} from '../../../core/articles';
import {
  ARTICLE_QUERY,
  STOCK_ARTICLE_QUERY,
  VENTES_ARTICLE_QUERY,
  VENTES_MENSUELLES_ARTICLE_QUERY,
  articlesQuery,
  type FiltresArticles,
  type StockDepotRow,
  type VentesArticleRow,
  type VentesMoisRow,
} from '../../../infrastructure/powersync/repositories/ArticlesRepository';
import { mouvementsQuery } from '../../../infrastructure/powersync/repositories/StockRepository';
import type { MouvementVue } from '../stock/hooks';
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

/** Un article suivi en temps réel (la fiche se met à jour si le prix change ailleurs). */
export function useArticle(articleId: string | null) {
  const { data } = useQuery<ArticleRow>(ARTICLE_QUERY, [articleId ?? '']);
  return useMemo(() => (data[0] ? articleFromRow(data[0]) : null), [data]);
}

/** Stock de l'article dépôt par dépôt, et ses totaux. */
export function useStockArticle(articleId: string | null) {
  const { data, isLoading } = useQuery<StockDepotRow>(STOCK_ARTICLE_QUERY, [articleId ?? '']);
  const lignes = useMemo<StockDepot[]>(
    () =>
      data.map((r) => ({
        depot_id: r.depot_id,
        depot_nom: r.depot_nom ?? '—',
        quantite: r.quantite ?? 0,
        quantite_reservee: r.quantite_reservee ?? 0,
        quantite_disponible: r.quantite_disponible ?? 0,
        cout_moyen: r.cout_moyen ?? 0,
        date_dernier_mouvement: r.date_dernier_mouvement,
      })),
    [data],
  );
  return { lignes, totaux: useMemo(() => totauxStock(lignes), [lignes]), isLoading };
}

/** Ventes de l'article depuis `debut` (ISO) : quantités, chiffre d'affaires, dernier prix pratiqué. */
export function useVentesArticle(articleId: string | null, debut: string) {
  const { data, isLoading } = useQuery<VentesArticleRow>(VENTES_ARTICLE_QUERY, [articleId ?? '', debut]);
  const ventes = useMemo<VentesArticle>(() => {
    const r = data[0];
    if (!r || !r.nombre_ventes) return VENTES_VIDES;
    return {
      quantite: r.quantite ?? 0,
      total_ht: r.total_ht ?? 0,
      total_ttc: r.total_ttc ?? 0,
      nombre_ventes: r.nombre_ventes,
      derniere_date: r.derniere_date,
      dernier_prix: r.dernier_prix,
    };
  }, [data]);
  return { ventes, isLoading };
}

/** Ventes mois par mois sur les 12 derniers mois. */
export function useVentesMensuellesArticle(articleId: string | null, debut: string) {
  const { data } = useQuery<VentesMoisRow>(VENTES_MENSUELLES_ARTICLE_QUERY, [articleId ?? '', debut]);
  return useMemo(
    () =>
      data.map((r) => ({
        mois: r.mois,
        nombre_ventes: r.nombre_ventes ?? 0,
        quantite: r.quantite ?? 0,
        total_ht: r.total_ht ?? 0,
        total_ttc: r.total_ttc ?? 0,
      })),
    [data],
  );
}

/** Derniers mouvements de stock de l'article, tous dépôts confondus. */
export function useMouvementsArticle(filialeId: string | null, articleId: string | null, limite = 30) {
  const { sql, params } = useMemo(() => mouvementsQuery(filialeId, { articleId, limite }), [filialeId, articleId, limite]);
  const { data, isLoading } = useQuery<MouvementVue>(sql, params);
  return { mouvements: data, isLoading };
}
