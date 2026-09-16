import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { CaisseRow, MouvementTresorerieRow } from '@quinca/shared-types';
import { caisseFromRow } from '../../../core/tresorerie';
import { CAISSES_QUERY, mouvementsTresorerieQuery, type FiltresTresorerie } from '../../../infrastructure/powersync/repositories/TresorerieRepository';

export function useCaissesToutes(filialeId: string | null) {
  const { data } = useQuery<CaisseRow>(CAISSES_QUERY, [filialeId ?? '']);
  return useMemo(() => data.map(caisseFromRow), [data]);
}

export interface MouvementTresorerieVue extends MouvementTresorerieRow {
  caisse_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
}

export function useMouvementsTresorerie(filialeId: string | null, filtres: FiltresTresorerie = {}) {
  const { sql, params } = useMemo(
    () => mouvementsTresorerieQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.caisseId, filtres.dateDebut, filtres.dateFin, filtres.type, filtres.limite],
  );
  const { data, isLoading } = useQuery<MouvementTresorerieVue>(sql, params);
  return { mouvements: data, isLoading };
}
