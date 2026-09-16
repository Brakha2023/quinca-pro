import { useQuery } from '@powersync/react';
import type { FilialeRow } from '@quinca/shared-types';
import { useCurrentUtilisateur } from './useCurrentUtilisateur';
import { useFilialeSelectionStore } from '../stores/filiales.store';

const FILIALES_ACTIVES_QUERY = 'SELECT * FROM filiales WHERE est_active = 1 ORDER BY type DESC, nom';

/**
 * Filiale dans laquelle l'utilisateur travaille :
 *  - imposée par son compte pour GERANT / CAISSIER / MAGASINIER ;
 *  - choisie dans le sélecteur pour un DIRECTEUR (null = vue consolidée).
 */
export function useFilialeCourante() {
  const { utilisateur } = useCurrentUtilisateur();
  const { data: filiales } = useQuery<FilialeRow>(FILIALES_ACTIVES_QUERY);
  const { filialeSelectionneeId, setFilialeSelectionneeId } = useFilialeSelectionStore();

  const estDirecteur = utilisateur?.profil === 'DIRECTEUR';
  const filialeId = estDirecteur ? filialeSelectionneeId : (utilisateur?.filiale_id ?? null);
  const filiale = filiales.find((f) => f.id === filialeId) ?? null;

  return {
    utilisateur,
    estDirecteur,
    /** Toutes les filiales visibles (une seule pour un non-directeur). */
    filiales,
    filialeId,
    filiale,
    /** Vrai quand un directeur n'a sélectionné aucune filiale (consolidation). */
    estVueConsolidee: estDirecteur && filialeId === null,
    peutChangerDeFiliale: estDirecteur,
    setFilialeId: setFilialeSelectionneeId,
  };
}
