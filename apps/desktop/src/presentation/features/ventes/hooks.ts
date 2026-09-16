import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { LigneVenteRow } from '@quinca/shared-types';
import { ligneVenteFromRow } from '../../../core/ventes';
import { LIGNES_VENTE_QUERY, ventesQuery, type FiltresVentes, type VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';

export function useVentes(filialeId: string | null, filtres: FiltresVentes = {}) {
  const { sql, params } = useMemo(
    () => ventesQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.jour, filtres.dateDebut, filtres.dateFin, filtres.caisseId, filtres.statut, filtres.recherche, filtres.limite],
  );
  const { data, isLoading } = useQuery<VenteVueRow>(sql, params);
  return { ventes: data, isLoading };
}

export function useLignesVente(venteId: string | null) {
  const { data } = useQuery<LigneVenteRow>(LIGNES_VENTE_QUERY, [venteId ?? '']);
  return useMemo(() => data.map(ligneVenteFromRow), [data]);
}
