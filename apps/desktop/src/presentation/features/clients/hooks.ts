import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { CaisseRow, ClientRow, ReglementClientRow } from '@quinca/shared-types';
import { clientFromRow, reglementFromRow } from '../../../core/clients';
import { CAISSES_ACTIVES_QUERY, REGLEMENTS_CLIENT_QUERY, clientsQuery, type FiltresClients } from '../../../infrastructure/powersync/repositories/ClientsRepository';

export function useClients(filialeId: string | null, filtres: FiltresClients = {}) {
  const { sql, params } = useMemo(
    () => clientsQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.recherche, filtres.inclureInactifs, filtres.avecCreance],
  );
  const { data, isLoading } = useQuery<ClientRow>(sql, params);
  const clients = useMemo(() => data.map(clientFromRow), [data]);
  return { clients, isLoading };
}

export function useClient(clientId: string | null) {
  const { data } = useQuery<ClientRow>('SELECT * FROM clients WHERE id = ?', [clientId ?? '']);
  return data[0] ? clientFromRow(data[0]) : null;
}

export interface ReglementVue extends ReglementClientRow {
  caisse_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
}

export function useReglementsClient(clientId: string | null) {
  const { data, isLoading } = useQuery<ReglementVue>(REGLEMENTS_CLIENT_QUERY, [clientId ?? '']);
  const reglements = useMemo(() => data.map((r) => ({ ...reglementFromRow(r), caisse_nom: r.caisse_nom, utilisateur: [r.utilisateur_prenom, r.utilisateur_nom].filter(Boolean).join(' ') })), [data]);
  return { reglements, isLoading };
}

export function useCaisses(filialeId: string | null) {
  const { data } = useQuery<CaisseRow>(CAISSES_ACTIVES_QUERY, [filialeId ?? '']);
  return data;
}
