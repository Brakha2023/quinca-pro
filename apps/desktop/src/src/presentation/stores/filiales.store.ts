import { create } from 'zustand';

export interface Filiale {
  id: string;
  code: string;
  nom: string;
  ville: string;
  type: 'MAISON_MERE' | 'FILIALE';
}

interface FilialesState {
  filiales: Filiale[];
  filialeSelectionnee: Filiale;
  
  setFilialeSelectionnee: (filiale: Filiale) => void;
  getFilialeById: (id: string) => Filiale | undefined;
}

const FILIALES_MOCK: Filiale[] = [
  {
    id: '1',
    code: 'MM',
    nom: 'Maison mère (Consolidé)',
    ville: 'Abidjan',
    type: 'MAISON_MERE',
  },
  {
    id: '2',
    code: 'ABJ',
    nom: 'Filiale Abidjan',
    ville: 'Abidjan',
    type: 'FILIALE',
  },
  {
    id: '3',
    code: 'BKE',
    nom: 'Filiale Bouaké',
    ville: 'Bouaké',
    type: 'FILIALE',
  },
  {
    id: '4',
    code: 'SPY',
    nom: 'Filiale San-Pedro',
    ville: 'San-Pedro',
    type: 'FILIALE',
  },
];

export const useFilialesStore = create<FilialesState>((set, get) => ({
  filiales: FILIALES_MOCK,
  filialeSelectionnee: FILIALES_MOCK[0],

  setFilialeSelectionnee: (filiale) => set({ filialeSelectionnee: filiale }),

  getFilialeById: (id) => get().filiales.find(f => f.id === id),
}));
