import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ReglagesPoste {
  caisseId: string;
  depotId: string;
}

interface PosteState {
  /** Réglages par filiale (un directeur peut changer de filiale). */
  parFiliale: Record<string, ReglagesPoste>;
  definir: (filialeId: string, reglages: ReglagesPoste) => void;
}

/** Caisse et dépôt de vente de ce poste, persistés localement. */
export const usePosteStore = create<PosteState>()(
  persist(
    (set) => ({
      parFiliale: {},
      definir: (filialeId, reglages) => set((s) => ({ parFiliale: { ...s.parFiliale, [filialeId]: reglages } })),
    }),
    { name: 'quinca-poste' },
  ),
);
