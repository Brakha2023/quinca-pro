import { create } from 'zustand';

export type TypeOperation = 'RECETTE' | 'DEPENSE' | 'TRANSFERT_ENTREE' | 'TRANSFERT_SORTIE';

export interface Operation {
  id: string;
  caisse_id: string;
  date: string;
  heure: string;
  type: TypeOperation;
  categorie: string;
  description: string;
  montant: number;
  reference?: string;
  caisse_destination_id?: string; // Pour les transferts
}

export interface Caisse {
  id: string;
  code: string;
  nom: string;
  responsable: string;
  solde: number;
  solde_initial: number;
  est_active: boolean;
  date_creation: string;
}

interface TresorerieState {
  caisses: Caisse[];
  operations: Operation[];
  caisseSelectionnee: Caisse | null;
  
  setCaisseSelectionnee: (caisse: Caisse | null) => void;
  addCaisse: (caisse: Omit<Caisse, 'id' | 'code' | 'solde' | 'date_creation'>) => void;
  updateCaisse: (id: string, data: Partial<Caisse>) => void;
  
  addOperation: (operation: Omit<Operation, 'id' | 'date' | 'heure'>) => void;
  getOperationsByCaisse: (caisseId: string) => Operation[];
  getSoldeCaisse: (caisseId: string) => number;
  
  transfererFonds: (caisseOrigineId: string, caisseDestinationId: string, montant: number, motif: string) => void;
}

const CAISSES_MOCK: Caisse[] = [
  {
    id: '1', code: 'CAIS-001', nom: 'Caisse Principale',
    responsable: 'Mme. Koné', solde: 1250000, solde_initial: 500000,
    est_active: true, date_creation: '2026-01-15',
  },
  {
    id: '2', code: 'CAIS-002', nom: 'Caisse Secondaire',
    responsable: 'M. Traoré', solde: 425000, solde_initial: 200000,
    est_active: true, date_creation: '2026-03-01',
  },
  {
    id: '3', code: 'CAIS-003', nom: 'Caisse Livraison',
    responsable: 'M. Diabaté', solde: 180000, solde_initial: 100000,
    est_active: true, date_creation: '2026-05-10',
  },
];

const OPERATIONS_MOCK: Operation[] = [
  { id: '1', caisse_id: '1', date: '2026-08-27', heure: '10:09', type: 'RECETTE', categorie: 'Vente', description: 'Vente #VTE-2026-00147', montant: 187500 },
  { id: '2', caisse_id: '1', date: '2026-08-27', heure: '09:45', type: 'RECETTE', categorie: 'Vente', description: 'Vente #VTE-2026-00146', montant: 67500 },
  { id: '3', caisse_id: '1', date: '2026-08-27', heure: '09:12', type: 'RECETTE', categorie: 'Vente', description: 'Vente #VTE-2026-00145', montant: 425000 },
  { id: '4', caisse_id: '1', date: '2026-08-27', heure: '08:30', type: 'DEPENSE', categorie: 'Transport', description: 'Livraison client Koné', montant: 15000 },
  { id: '5', caisse_id: '1', date: '2026-08-27', heure: '08:00', type: 'DEPENSE', categorie: 'Fournitures', description: 'Achat sacs plastique', montant: 8500 },
  { id: '6', caisse_id: '2', date: '2026-08-27', heure: '11:00', type: 'RECETTE', categorie: 'Vente', description: 'Ventes matin', montant: 125000 },
  { id: '7', caisse_id: '2', date: '2026-08-27', heure: '10:00', type: 'DEPENSE', categorie: 'Repas', description: 'Déjeuner équipe', montant: 25000 },
  { id: '8', caisse_id: '1', date: '2026-08-26', heure: '14:00', type: 'TRANSFERT_SORTIE', categorie: 'Transfert', description: 'Transfert vers Caisse Secondaire', montant: 100000, caisse_destination_id: '2' },
  { id: '9', caisse_id: '2', date: '2026-08-26', heure: '14:00', type: 'TRANSFERT_ENTREE', categorie: 'Transfert', description: 'Reçu de Caisse Principale', montant: 100000 },
];

export const useTresorerieStore = create<TresorerieState>((set, get) => ({
  caisses: CAISSES_MOCK,
  operations: OPERATIONS_MOCK,
  caisseSelectionnee: CAISSES_MOCK[0],

  setCaisseSelectionnee: (caisse) => set({ caisseSelectionnee: caisse }),

  addCaisse: (caisseData) => {
    const newCaisse: Caisse = {
      ...caisseData,
      id: Date.now().toString(),
      code: `CAIS-${String(get().caisses.length + 1).padStart(3, '0')}`,
      solde: caisseData.solde_initial,
      date_creation: new Date().toISOString().split('T')[0],
    };
    set({ caisses: [...get().caisses, newCaisse] });
  },

  updateCaisse: (id, data) => {
    set({
      caisses: get().caisses.map(c => c.id === id ? { ...c, ...data } : c),
    });
  },

  addOperation: (operationData) => {
    const now = new Date();
    const newOperation: Operation = {
      ...operationData,
      id: Date.now().toString(),
      date: now.toISOString().split('T')[0],
      heure: now.toTimeString().slice(0, 5),
    };

    // Mettre à jour le solde de la caisse
    const caisse = get().caisses.find(c => c.id === operationData.caisse_id);
    if (caisse) {
      let nouveauSolde = caisse.solde;
      if (operationData.type === 'RECETTE' || operationData.type === 'TRANSFERT_ENTREE') {
        nouveauSolde += operationData.montant;
      } else if (operationData.type === 'DEPENSE' || operationData.type === 'TRANSFERT_SORTIE') {
        nouveauSolde -= operationData.montant;
      }
      get().updateCaisse(caisse.id, { solde: nouveauSolde });
    }

    set({ operations: [...get().operations, newOperation] });
  },

  getOperationsByCaisse: (caisseId) => {
    return get().operations.filter(op => op.caisse_id === caisseId);
  },

  getSoldeCaisse: (caisseId) => {
    const caisse = get().caisses.find(c => c.id === caisseId);
    return caisse ? caisse.solde : 0;
  },

  transfererFonds: (caisseOrigineId, caisseDestinationId, montant, motif) => {
    // Sortie de la caisse origine
    get().addOperation({
      caisse_id: caisseOrigineId,
      type: 'TRANSFERT_SORTIE',
      categorie: 'Transfert',
      description: motif || `Transfert vers ${get().caisses.find(c => c.id === caisseDestinationId)?.nom}`,
      montant,
      caisse_destination_id: caisseDestinationId,
    });

    // Entrée dans la caisse destination
    get().addOperation({
      caisse_id: caisseDestinationId,
      type: 'TRANSFERT_ENTREE',
      categorie: 'Transfert',
      description: motif || `Reçu de ${get().caisses.find(c => c.id === caisseOrigineId)?.nom}`,
      montant,
    });
  },
}));
