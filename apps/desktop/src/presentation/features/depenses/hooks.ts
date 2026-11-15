import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { DepenseRow } from '@quinca/shared-types';
import { depenseFromRow, type Depense } from '../../../core/depenses';
import {
  DEPENSES_QUERY, depensesParams, type FiltresDepenses,
} from '../../../infrastructure/powersync/repositories/DepensesRepository';

/** La dépense enrichie des noms que la liste affiche. */
export interface DepenseVue extends Depense {
  caisse_nom: string | null;
  /** Qui a engagé la dépense. */
  auteur: string | null;
  /** Qui l'a approuvée ou refusée. */
  approbateur: string | null;
}

type LigneDepense = DepenseRow & {
  caisse_nom: string | null;
  auteur_nom: string | null;
  auteur_prenom: string | null;
  approbateur_nom: string | null;
  approbateur_prenom: string | null;
};

const nom = (prenom: string | null, patronyme: string | null) =>
  [prenom, patronyme].filter(Boolean).join(' ') || null;

export function useDepenses(filialeId: string | null, filtres: FiltresDepenses) {
  const params = useMemo(
    () => depensesParams(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.dateDebut, filtres.dateFin, filtres.caisseId, filtres.statut, filtres.recherche],
  );
  const { data, isLoading } = useQuery<LigneDepense>(DEPENSES_QUERY, params);
  const depenses = useMemo<DepenseVue[]>(
    () => data.map((row) => ({
      ...depenseFromRow(row),
      caisse_nom: row.caisse_nom,
      auteur: nom(row.auteur_prenom, row.auteur_nom),
      approbateur: nom(row.approbateur_prenom, row.approbateur_nom),
    })),
    [data],
  );
  return { depenses, isLoading };
}
