import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { CommandeFournisseurRow, FournisseurRow, ReglementFournisseurRow } from '@quinca/shared-types';
import { commandeFromRow, fournisseurFromRow, reglementFournisseurFromRow } from '../../../core/fournisseurs';
import { ACHATS_FOURNISSEUR_QUERY, REGLEMENTS_FOURNISSEUR_QUERY, fournisseursQuery, type FiltresFournisseurs } from '../../../infrastructure/powersync/repositories/FournisseursRepository';

export function useFournisseurs(filialeId: string | null, filtres: FiltresFournisseurs = {}) {
  const { sql, params } = useMemo(
    () => fournisseursQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.recherche, filtres.inclureInactifs, filtres.avecDette],
  );
  const { data, isLoading } = useQuery<FournisseurRow>(sql, params);
  const fournisseurs = useMemo(() => data.map(fournisseurFromRow), [data]);
  return { fournisseurs, isLoading };
}

export function useFournisseur(id: string | null) {
  const { data } = useQuery<FournisseurRow>('SELECT * FROM fournisseurs WHERE id = ?', [id ?? '']);
  return data[0] ? fournisseurFromRow(data[0]) : null;
}

export function useAchatsFournisseur(id: string | null) {
  const { data } = useQuery<CommandeFournisseurRow>(ACHATS_FOURNISSEUR_QUERY, [id ?? '']);
  return useMemo(() => data.map(commandeFromRow), [data]);
}

export function useReglementsFournisseur(id: string | null) {
  const { data } = useQuery<ReglementFournisseurRow & { caisse_nom: string | null }>(REGLEMENTS_FOURNISSEUR_QUERY, [id ?? '']);
  return useMemo(() => data.map((r) => ({ ...reglementFournisseurFromRow(r), caisse_nom: r.caisse_nom })), [data]);
}
