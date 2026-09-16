import { create } from 'zustand';

export interface Fournisseur {
  id: string;
  code: string;
  numero_compte: string;  // N° compte comptable
  raison_sociale: string;
  famille: string;         // Catégorie
  type_article: string;    // Type d'article fourni
  telephone: string;
  email?: string;
  adresse: string;
  solde_initial: number;   // Solde d'ouverture
  cumul_factures: number;  // Total factures
  cumul_reglements: number; // Total paiements
  solde_actuel: number;    // Calculé: Initial + Factures - Règlements
  est_actif: boolean;
}

interface FournisseursState {
  fournisseurs: Fournisseur[];
  recherche: string;
  familleFiltre: string;
  
  setRecherche: (query: string) => void;
  setFamilleFiltre: (famille: string) => void;
  addFournisseur: (fournisseur: Omit<Fournisseur, 'id' | 'code' | 'cumul_factures' | 'cumul_reglements' | 'solde_actuel'>) => void;
  updateFournisseur: (id: string, data: Partial<Fournisseur>) => void;
  deleteFournisseur: (id: string) => void;
  getFournisseursFiltres: () => Fournisseur[];
  
  // Opérations comptables
  enregistrerFacture: (fournisseurId: string, montant: number, reference: string) => void;
  enregistrerReglement: (fournisseurId: string, montant: number, reference: string) => void;
  calculerSolde: (fournisseur: Fournisseur) => number;
}

const FOURNISSEURS_MOCK: Fournisseur[] = [
  {
    id: '1', code: 'FOU-001', numero_compte: '401001',
    raison_sociale: '3K IMPORT/EXPORT', famille: 'Import-Export',
    type_article: 'Quincaillerie générale',
    telephone: '27 21 25 70 81', adresse: 'Abidjan',
    solde_initial: 0, cumul_factures: 5378201, cumul_reglements: 5378000,
    solde_actuel: 201, est_actif: true,
  },
  {
    id: '2', code: 'FOU-002', numero_compte: '401002',
    raison_sociale: 'ABED ADJAME', famille: 'Sanitaire',
    type_article: 'Articles sanitaires',
    telephone: '07 59 13 98 85', adresse: 'Adjamé, Abidjan',
    solde_initial: 0, cumul_factures: 4300000, cumul_reglements: 4300000,
    solde_actuel: 0, est_actif: true,
  },
  {
    id: '3', code: 'FOU-003', numero_compte: '401003',
    raison_sociale: 'ABOU 1', famille: 'Matériaux',
    type_article: 'Ciment, sable',
    telephone: '', adresse: '',
    solde_initial: 0, cumul_factures: 4988890, cumul_reglements: 4988890,
    solde_actuel: 0, est_actif: true,
  },
  {
    id: '4', code: 'FOU-004', numero_compte: '401004',
    raison_sociale: 'ADAM PLAT', famille: 'Plomberie',
    type_article: 'Articles plomberie',
    telephone: '07 07 93 91 60', adresse: '',
    solde_initial: 0, cumul_factures: 0, cumul_reglements: 1496950,
    solde_actuel: -1496950, est_actif: true,
  },
  {
    id: '5', code: 'FOU-005', numero_compte: '401005',
    raison_sociale: 'ALI GHANDOUR KING BAT', famille: 'Matériaux',
    type_article: 'Matériaux construction',
    telephone: '07 47 10 10 10', adresse: '',
    solde_initial: 0, cumul_factures: 31455800, cumul_reglements: 21000000,
    solde_actuel: 10455800, est_actif: true,
  },
];

export const useFournisseursStore = create<FournisseursState>((set, get) => ({
  fournisseurs: FOURNISSEURS_MOCK,
  recherche: '',
  familleFiltre: 'Toutes',

  setRecherche: (query) => set({ recherche: query }),
  setFamilleFiltre: (famille) => set({ familleFiltre: famille }),

  addFournisseur: (data) => {
    const newFournisseur: Fournisseur = {
      ...data,
      id: Date.now().toString(),
      code: `FOU-${String(get().fournisseurs.length + 1).padStart(3, '0')}`,
      cumul_factures: 0,
      cumul_reglements: 0,
      solde_actuel: data.solde_initial,
    };
    set({ fournisseurs: [...get().fournisseurs, newFournisseur] });
  },

  updateFournisseur: (id, data) => {
    set({
      fournisseurs: get().fournisseurs.map(f => 
        f.id === id ? { ...f, ...data } : f
      ),
    });
  },

  deleteFournisseur: (id) => {
    set({ fournisseurs: get().fournisseurs.filter(f => f.id !== id) });
  },

  getFournisseursFiltres: () => {
    const { fournisseurs, recherche, familleFiltre } = get();
    return fournisseurs.filter(f => {
      const matchRecherche = 
        f.raison_sociale.toLowerCase().includes(recherche.toLowerCase()) ||
        f.code.toLowerCase().includes(recherche.toLowerCase()) ||
        f.numero_compte.includes(recherche);
      const matchFamille = familleFiltre === 'Toutes' || f.famille === familleFiltre;
      return matchRecherche && matchFamille;
    });
  },

  calculerSolde: (fournisseur) => {
    return fournisseur.solde_initial + fournisseur.cumul_factures - fournisseur.cumul_reglements;
  },

  enregistrerFacture: (fournisseurId, montant, reference) => {
    set({
      fournisseurs: get().fournisseurs.map(f => {
        if (f.id === fournisseurId) {
          const newCumulFactures = f.cumul_factures + montant;
          return {
            ...f,
            cumul_factures: newCumulFactures,
            solde_actuel: f.solde_initial + newCumulFactures - f.cumul_reglements,
          };
        }
        return f;
      }),
    });
  },

  enregistrerReglement: (fournisseurId, montant, reference) => {
    set({
      fournisseurs: get().fournisseurs.map(f => {
        if (f.id === fournisseurId) {
          const newCumulReglements = f.cumul_reglements + montant;
          return {
            ...f,
            cumul_reglements: newCumulReglements,
            solde_actuel: f.solde_initial + f.cumul_factures - newCumulReglements,
          };
        }
        return f;
      }),
    });
  },
}));
