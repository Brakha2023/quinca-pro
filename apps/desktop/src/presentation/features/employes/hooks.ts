import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { AvanceSalaireRow, EmployeRow, PaieRow, PointageRow } from '@quinca/shared-types';
import { employeFromRow, paieFromRow, pointageFromRow } from '../../../core/employes';
import {
  AVANCES_PERIODE_QUERY, EMPLOYE_QUERY, PAIES_PERIODE_QUERY, PERIODES_PAIE_QUERY, POINTAGES_JOUR_QUERY, POINTAGES_MOIS_QUERY, employesQuery, type FiltresEmployes,
} from '../../../infrastructure/powersync/repositories/EmployesRepository';

export function useEmployes(filialeId: string | null, filtres: FiltresEmployes = {}) {
  const { sql, params } = useMemo(
    () => employesQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.recherche, filtres.inclureInactifs],
  );
  const { data, isLoading } = useQuery<EmployeRow>(sql, params);
  const employes = useMemo(() => data.map(employeFromRow), [data]);
  return { employes, isLoading };
}

/** Fiche complète (pièces jointes comprises). */
export function useEmploye(id: string | null) {
  const { data } = useQuery<EmployeRow>(EMPLOYE_QUERY, [id ?? '']);
  return data[0] ? employeFromRow(data[0]) : null;
}

export function usePointagesJour(filialeId: string | null, jour: string) {
  const { data } = useQuery<PointageRow>(POINTAGES_JOUR_QUERY, [filialeId ?? '', jour]);
  return useMemo(() => new Map(data.map((p) => [p.employe_id ?? '', pointageFromRow(p)])), [data]);
}

export function usePointagesMois(filialeId: string | null, periode: string) {
  const { data } = useQuery<PointageRow>(POINTAGES_MOIS_QUERY, [filialeId ?? '', periode]);
  return useMemo(() => data.map(pointageFromRow), [data]);
}

export interface PaieVue extends ReturnType<typeof paieFromRow> {
  matricule: string;
  nom: string;
  prenom: string | null;
  fonction: string | null;
  type_contrat: string;
  caisse_nom: string | null;
}

export function usePaies(filialeId: string | null, periode: string) {
  const { data, isLoading } = useQuery<PaieRow & { matricule: string; nom: string; prenom: string | null; fonction: string | null; type_contrat: string; caisse_nom: string | null }>(PAIES_PERIODE_QUERY, [filialeId ?? '', periode]);
  const paies = useMemo<PaieVue[]>(() => data.map((r) => ({ ...paieFromRow(r), matricule: r.matricule, nom: r.nom, prenom: r.prenom, fonction: r.fonction, type_contrat: r.type_contrat, caisse_nom: r.caisse_nom })), [data]);
  return { paies, isLoading };
}

export interface AvanceVue extends AvanceSalaireRow { matricule: string; nom: string; prenom: string | null; caisse_nom: string | null }

export function useAvances(filialeId: string | null, periode: string) {
  const { data } = useQuery<AvanceVue>(AVANCES_PERIODE_QUERY, [filialeId ?? '', periode]);
  return data;
}

export function usePeriodesPaie(filialeId: string | null) {
  const { data } = useQuery<{ periode: string }>(PERIODES_PAIE_QUERY, [filialeId ?? '']);
  return data.map((p) => p.periode);
}
