import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FormatImpression } from '../../core/ventes';

export interface ReglagesPoste {
  caisseId: string;
  depotId: string;
}

interface PosteState {
  /** Réglages par filiale (un directeur peut changer de filiale). */
  parFiliale: Record<string, ReglagesPoste>;
  /** Sortie papier par défaut de ce poste : l'imprimante est une propriété de la machine, pas de la filiale. */
  format: FormatImpression;
  definir: (filialeId: string, reglages: ReglagesPoste) => void;
  definirFormat: (format: FormatImpression) => void;
}

/** Caisse et dépôt de vente de ce poste, persistés localement. */
export const usePosteStore = create<PosteState>()(
  persist(
    (set) => ({
      parFiliale: {},
      format: 'TICKET',
      definir: (filialeId, reglages) => set((s) => ({ parFiliale: { ...s.parFiliale, [filialeId]: reglages } })),
      definirFormat: (format) => set({ format }),
    }),
    { name: 'quinca-poste' },
  ),
);
