import { useCallback, useMemo } from 'react';
import { usePowerSync, useQuery } from '@powersync/react';
import type { ArticleRow, CaisseRow, DepotRow, VenteBrouillonRow } from '@quinca/shared-types';
import { articleFromRow, type Article } from '../../../core/articles';
import { brouillonFromRow, type Brouillon } from '../../../core/ventes';
import { BROUILLONS_QUERY } from '../../../infrastructure/powersync/repositories/BrouillonsRepository';
import { catalogueQuery } from '../../../infrastructure/powersync/repositories/ArticlesRepository';
import { CAISSES_ACTIVES_QUERY } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import { DEPOTS_ACTIFS_QUERY } from '../../../infrastructure/powersync/repositories/DepotsRepository';
import { usePosteStore } from '../../stores/poste.store';

export interface ArticleCatalogue extends Article {
  stock_disponible: number;
}

export function useCatalogue(filialeId: string | null, depotId: string | null, filtres: { recherche?: string; familleId?: string | null }) {
  const { sql, params } = useMemo(
    () => catalogueQuery(filialeId, depotId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, depotId, filtres.recherche, filtres.familleId],
  );
  const { data, isLoading } = useQuery<ArticleRow & { stock_disponible: number }>(sql, params);
  const articles = useMemo<ArticleCatalogue[]>(() => data.map((r) => ({ ...articleFromRow(r), stock_disponible: r.stock_disponible ?? 0 })), [data]);

  const db = usePowerSync();
  /**
   * Résultat unique d'une recherche, lu directement en base : indépendant de
   * l'état de rendu (qui repasse par « vide » à chaque frappe), donc fiable
   * pour « Entrée ajoute l'article » et les lecteurs de codes-barres.
   */
  const rechercherUnique = useCallback(
    async (recherche: string): Promise<ArticleCatalogue | null> => {
      const q = catalogueQuery(filialeId, depotId, { recherche, familleId: filtres.familleId });
      const rows = await db.getAll<ArticleRow & { stock_disponible: number }>(q.sql, q.params);
      const exact = rows.find((r) => (r.code ?? '').toUpperCase() === recherche.trim().toUpperCase());
      const r = exact ?? (rows.length === 1 ? rows[0] : null);
      return r ? { ...articleFromRow(r), stock_disponible: r.stock_disponible ?? 0 } : null;
    },
    [db, filialeId, depotId, filtres.familleId],
  );

  return { articles, isLoading, rechercherUnique };
}

/**
 * Ventes mises de côté dans la filiale, toutes caisses confondues : un ticket
 * commencé sur un poste se reprend depuis un autre.
 */
export function useBrouillons(filialeId: string | null) {
  const { data, isLoading } = useQuery<VenteBrouillonRow & { utilisateur_nom: string | null; utilisateur_prenom: string | null }>(
    BROUILLONS_QUERY,
    [filialeId ?? ''],
  );
  const brouillons = useMemo<Brouillon[]>(() => data.map(brouillonFromRow), [data]);
  return { brouillons, isLoading };
}

/** Réglages du poste pour la filiale courante, résolus avec les lignes caisse/dépôt. */
export function usePoste(filialeId: string | null) {
  const { parFiliale, definir, format, definirFormat } = usePosteStore();
  const { data: caisses } = useQuery<CaisseRow>(CAISSES_ACTIVES_QUERY, [filialeId ?? '']);
  const { data: depots } = useQuery<DepotRow>(DEPOTS_ACTIFS_QUERY, [filialeId ?? '']);
  const reglages = filialeId ? parFiliale[filialeId] : undefined;
  const caisse = caisses.find((c) => c.id === reglages?.caisseId) ?? null;
  const depot = depots.find((d) => d.id === reglages?.depotId) ?? null;
  return {
    caisses,
    depots,
    caisse,
    depot,
    estConfigure: Boolean(caisse && depot),
    format,
    definir: (caisseId: string, depotId: string) => filialeId && definir(filialeId, { caisseId, depotId }),
    definirFormat,
  };
}
