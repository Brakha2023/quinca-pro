import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { CaisseRow, ClientRow, LigneProformaRow, ProformaRow, ReglementClientRow } from '@quinca/shared-types';
import { clientFromRow, reglementFromRow, type FactureClient } from '../../../core/clients';
import { proformaFromRow } from '../../../core/ventes';
import {
  CAISSES_ACTIVES_QUERY, FACTURES_CLIENT_QUERY, GROUPES_CLIENTS_QUERY, REGLEMENTS_CLIENT_QUERY, clientsQuery, versementsQuery,
  type FiltresClients, type FiltresVersements,
} from '../../../infrastructure/powersync/repositories/ClientsRepository';
import { LIGNES_PROFORMA_QUERY, proformasQuery, type FiltresProformas } from '../../../infrastructure/powersync/repositories/ProformasRepository';

export function useClients(filialeId: string | null, filtres: FiltresClients = {}) {
  const { sql, params } = useMemo(
    () => clientsQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.recherche, filtres.inclureInactifs, filtres.avecCreance, filtres.groupe, filtres.avecEmail],
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

export function useGroupesClients(filialeId: string | null) {
  const { data } = useQuery<{ groupe: string }>(GROUPES_CLIENTS_QUERY, [filialeId ?? '']);
  return data.map((g) => g.groupe);
}

export interface FactureClientVue extends FactureClient { mode_paiement: string | null }

export function useFacturesClient(clientId: string | null) {
  const { data, isLoading } = useQuery<FactureClientVue>(FACTURES_CLIENT_QUERY, [clientId ?? '']);
  return { factures: data, isLoading };
}

export interface VersementVueRow extends ReglementClientRow {
  client_nom: string | null;
  client_code: string | null;
  vente_numero: string | null;
  caisse_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
}

export function useVersements(filialeId: string | null, filtres: FiltresVersements = {}) {
  const { sql, params } = useMemo(
    () => versementsQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.clientId, filtres.dateDebut, filtres.dateFin, filtres.limite],
  );
  const { data, isLoading } = useQuery<VersementVueRow>(sql, params);
  return { versements: data, isLoading };
}

export interface ProformaVueRow extends ProformaRow {
  client_libelle: string | null;
  vente_numero: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
  nombre_lignes: number;
}

export function useProformas(filialeId: string | null, filtres: FiltresProformas = {}) {
  const { sql, params } = useMemo(
    () => proformasQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.clientId, filtres.enCoursSeulement, filtres.recherche, filtres.limite],
  );
  const { data, isLoading } = useQuery<ProformaVueRow>(sql, params);
  const proformas = useMemo(() => data.map((r) => ({ ...proformaFromRow(r), client_libelle: r.client_libelle, vente_numero: r.vente_numero, utilisateur: [r.utilisateur_prenom, r.utilisateur_nom].filter(Boolean).join(' '), nombre_lignes: r.nombre_lignes })), [data]);
  return { proformas, isLoading };
}

export function useLignesProforma(proformaId: string | null) {
  const { data } = useQuery<LigneProformaRow>(LIGNES_PROFORMA_QUERY, [proformaId ?? '']);
  return data;
}
