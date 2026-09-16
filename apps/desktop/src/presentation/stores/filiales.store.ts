import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Filiale choisie par un DIRECTEUR pour travailler « comme » une filiale.
 * Sans objet pour les autres profils (leur filiale est imposée par leur compte).
 * Persisté localement pour survivre au redémarrage du poste.
 */
interface FilialeSelectionState {
  filialeSelectionneeId: string | null;
  setFilialeSelectionneeId: (id: string | null) => void;
}

export const useFilialeSelectionStore = create<FilialeSelectionState>()(
  persist(
    (set) => ({
      filialeSelectionneeId: null,
      setFilialeSelectionneeId: (id) => set({ filialeSelectionneeId: id }),
    }),
    { name: 'quinca-filiale-selectionnee' },
  ),
);
