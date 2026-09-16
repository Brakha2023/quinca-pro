import { create } from 'zustand';

export type StatutFacture = 'DEVIS' | 'FACTURE' | 'PAYEE' | 'ANNULEE';
export type TypeReglement = 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'MOBILE_MONEY';

export interface Client {
  id: string;
  code: string;
  raison_sociale: string;
  mobile: string;
  email?: string;
  adresse: string;
  contact?: string;
  solde_initial: number;
  cumul_factures: number;
  cumul_reglements: number;
  solde_actuel: number;
  disponibilite: number;
  plafond_credit: number;
  est_actif: boolean;
  date_creation: string;
}

export interface Facture {
  id: string;
  numero: string;
  client_id: string;
  date: string;
  heure: string;
  type: 'DEVIS' | 'FACTURE';
  statut: StatutFacture;
  lignes: LigneFacture[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  reste_a_payer: number;
  montant_paye: number;
  conditions_reglement: string;
  notes?: string;
}

export interface LigneFacture {
  code_ref: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  remise: number;
  total_ht: number;
  tva: number;
  depot: string;
}

export interface Reglement {
  id: string;
  numero: string;
  client_id: string;
  date: string;
  montant: number;
  type_reglement: TypeReglement;
  facture_id?: string;
  reference?: string;
}

interface ClientsState {
  clients: Client[];
  factures: Facture[];
  reglements: Reglement[];
  clientSelectionne: Client | null;
  recherche: string;
  
  setClientSelectionne: (client: Client | null) => void;
  setRecherche: (query: string) => void;
  addClient: (client: Omit<Client, 'id' | 'code' | 'cumul_factures' | 'cumul_reglements' | 'solde_actuel' | 'disponibilite' | 'date_creation'>) => void;
  updateClient: (id: string, data: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  getClientsFiltres: () => Client[];
  calculerSolde: (client: Client) => number;
  
  // Factures
  createFacture: (facture: Omit<Facture, 'id' | 'numero'>) => void;
  updateFactureStatut: (factureId: string, statut: StatutFacture) => void;
  getFacturesByClient: (clientId: string) => Facture[];
  
  // Règlements
  addReglement: (reglement: Omit<Reglement, 'id' | 'numero'>) => void;
  getReglementsByClient: (clientId: string) => Reglement[];
  
  // Relances
  sendRelance: (client_id: string, facture_id: string) => void;
}

const CLIENTS_MOCK: Client[] = [
  {
    id: '1', code: '101', raison_sociale: 'ABDOUL AZIZ BITCHANGA',
    mobile: '07 47 07 16 49', email: 'abdoul@example.com',
    adresse: 'Cocody, Abidjan', contact: 'M. Abdoul',
    solde_initial: 0, cumul_factures: 11489068, cumul_reglements: 11347106,
    solde_actuel: 141962, disponibilite: 68024071, plafond_credit: 100000000,
    est_actif: true, date_creation: '2024-01-15',
  },
  {
    id: '2', code: '102', raison_sociale: 'ABDOUL KARI KEITA',
    mobile: '07 07 60 83 58', email: 'kari@example.com',
    adresse: 'Yopougon, Abidjan', contact: 'M. Kari',
    solde_initial: 0, cumul_factures: 5500000, cumul_reglements: 5500000,
    solde_actuel: 0, disponibilite: 50000000, plafond_credit: 50000000,
    est_actif: true, date_creation: '2024-03-20',
  },
  {
    id: '3', code: 'CLI-DIVERS', raison_sociale: 'Client Comptoir',
    mobile: '', adresse: '',
    solde_initial: 0, cumul_factures: 0, cumul_reglements: 0,
    solde_actuel: 0, disponibilite: 0, plafond_credit: 0,
    est_actif: true, date_creation: '2024-01-01',
  },
];

const FACTURES_MOCK: Facture[] = [
  {
    id: '1', numero: 'V20260827-22211', client_id: '1',
    date: '2026-08-27', heure: '10:26',
    type: 'FACTURE', statut: 'FACTURE',
    lignes: [
      { code_ref: 'PPAS6', designation: 'PAQUET POINTE ASIL N6', quantite: 9, prix_unitaire_ht: 400, remise: 0, total_ht: 3600, tva: 0, depot: 'CENTRAL' },
      { code_ref: 'PPAS4', designation: 'PAQUET POINTE ASIL N4', quantite: 1, prix_unitaire_ht: 400, remise: 0, total_ht: 400, tva: 0, depot: 'CENTRAL' },
    ],
    total_ht: 4000, total_tva: 0, total_ttc: 4000,
    reste_a_payer: 0, montant_paye: 4000,
    conditions_reglement: 'COMPTANT',
  },
];

export const useClientsStore = create<ClientsState>((set, get) => ({
  clients: CLIENTS_MOCK,
  factures: FACTURES_MOCK,
  reglements: [],
  clientSelectionne: null,
  recherche: '',

  setClientSelectionne: (client) => set({ clientSelectionne: client }),
  setRecherche: (query) => set({ recherche: query }),

  addClient: (data) => {
    const newClient: Client = {
      ...data,
      id: Date.now().toString(),
      code: `CLI-${String(get().clients.length + 1).padStart(3, '0')}`,
      cumul_factures: 0,
      cumul_reglements: 0,
      solde_actuel: data.solde_initial,
      disponibilite: data.plafond_credit - data.solde_initial,
      date_creation: new Date().toISOString().split('T')[0],
    };
    set({ clients: [...get().clients, newClient] });
  },

  updateClient: (id, data) => {
    set({
      clients: get().clients.map(c => c.id === id ? { ...c, ...data } : c),
    });
  },

  deleteClient: (id) => {
    set({ clients: get().clients.filter(c => c.id !== id) });
  },

  getClientsFiltres: () => {
    const { clients, recherche } = get();
    return clients.filter(c =>
      c.raison_sociale.toLowerCase().includes(recherche.toLowerCase()) ||
      c.code.toLowerCase().includes(recherche.toLowerCase()) ||
      c.mobile.includes(recherche)
    );
  },

  calculerSolde: (client) => {
    return client.solde_initial + client.cumul_factures - client.cumul_reglements;
  },

  createFacture: (factureData) => {
    const newFacture: Facture = {
      ...factureData,
      id: Date.now().toString(),
      numero: `V${new Date().toISOString().replace(/[-T:]/g, '').slice(0, 14)}-${Math.floor(Math.random() * 100000)}`,
    };
    set({ factures: [...get().factures, newFacture] });
    
    // Mettre à jour le cumul factures du client
    const client = get().clients.find(c => c.id === factureData.client_id);
    if (client) {
      get().updateClient(client.id, {
        cumul_factures: client.cumul_factures + factureData.total_ttc,
        solde_actuel: client.solde_actuel + factureData.total_ttc,
        disponibilite: client.disponibilite - factureData.total_ttc,
      });
    }
  },

  updateFactureStatut: (factureId, statut) => {
    set({
      factures: get().factures.map(f => f.id === factureId ? { ...f, statut } : f),
    });
  },

  getFacturesByClient: (clientId) => {
    return get().factures.filter(f => f.client_id === clientId);
  },

  addReglement: (reglementData) => {
    const newReglement: Reglement = {
      ...reglementData,
      id: Date.now().toString(),
      numero: `REG-${Date.now()}`,
    };
    set({ reglements: [...get().reglements, newReglement] });
    
    // Mettre à jour le client
    const client = get().clients.find(c => c.id === reglementData.client_id);
    if (client) {
      get().updateClient(client.id, {
        cumul_reglements: client.cumul_reglements + reglementData.montant,
        solde_actuel: client.solde_actuel - reglementData.montant,
        disponibilite: client.disponibilite + reglementData.montant,
      });
    }
    
    // Mettre à jour la facture si liée
    if (reglementData.facture_id) {
      const facture = get().factures.find(f => f.id === reglementData.facture_id);
      if (facture) {
        const nouveauReste = Math.max(0, facture.reste_a_payer - reglementData.montant);
        const nouveauMontantPaye = facture.montant_paye + reglementData.montant;
        const nouveauStatut = nouveauReste === 0 ? 'PAYEE' : 'FACTURE';
        set({
          factures: get().factures.map(f => f.id === reglementData.facture_id ? {
            ...f,
            reste_a_payer: nouveauReste,
            montant_paye: nouveauMontantPaye,
            statut: nouveauStatut as StatutFacture,
          } : f),
        });
      }
    }
  },

  getReglementsByClient: (clientId) => {
    return get().reglements.filter(r => r.client_id === clientId);
  },

  sendRelance: (client_id, facture_id) => {
    const client = get().clients.find(c => c.id === client_id);
    const facture = get().factures.find(f => f.id === facture_id);
    
    if (client && facture && client.email) {
      // Simulation d'envoi d'email
      console.log(`[RELANCE EMAIL] À: ${client.email}`);
      console.log(`Objet: Relance facture ${facture.numero}`);
      console.log(`Montant dû: ${facture.reste_a_payer.toLocaleString('fr-FR')} FCFA`);
      alert(`✅ Email de relance envoyé à ${client.email}\nFacture: ${facture.numero}\nMontant: ${facture.reste_a_payer.toLocaleString('fr-FR')} FCFA`);
    } else {
      alert('❌ Email non disponible pour ce client');
    }
  },
}));
