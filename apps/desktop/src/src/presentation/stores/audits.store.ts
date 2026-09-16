export type ActionType = 
  | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'LOGIN' | 'LOGOUT'
  | 'SALE' | 'STOCK_IN' | 'STOCK_OUT'
  | 'TRANSFER' | 'PAYMENT'
  | 'IMPORT' | 'EXPORT'
  | 'PRINT';

export interface AuditLog {
  id: string;
  timestamp: string;
  user_id: string;
  user_name: string;
  action: ActionType;
  module: string;
  description: string;
  entity_type?: string;
  entity_id?: string;
  old_value?: any;
  new_value?: any;
  ip_address?: string;
  details?: string;
}

interface AuditState {
  logs: AuditLog[];
  filtreUser: string;
  filtreModule: string;
  filtreDateDebut: string;
  filtreDateFin: string;
  
  addLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  getLogsFiltres: () => AuditLog[];
  clearLogs: () => void;
  setFiltres: (filters: Partial<Pick<AuditState, 'filtreUser' | 'filtreModule' | 'filtreDateDebut' | 'filtreDateFin'>>) => void;
}

import { create } from 'zustand';

const MOCK_LOGS: AuditLog[] = [
  {
    id: '1', timestamp: '2026-08-27 10:09:15',
    user_id: '1', user_name: 'Souleymane Cissé',
    action: 'SALE', module: 'Point de Vente',
    description: 'Vente validée - Ticket #VTE-2026-00147',
    entity_type: 'Vente', entity_id: '147',
    new_value: { montant: 187500, client: 'SARL Bâtiment Plus' },
  },
  {
    id: '2', timestamp: '2026-08-27 09:45:22',
    user_id: '2', user_name: 'Mme. Koné',
    action: 'STOCK_IN', module: 'Stock',
    description: 'Ajout de stock: 50 unités - Abattant WC Industap',
    entity_type: 'Article', entity_id: '1',
    new_value: { quantite: 50, motif: 'Réception achat' },
  },
  {
    id: '3', timestamp: '2026-08-27 09:30:10',
    user_id: '1', user_name: 'Souleymane Cissé',
    action: 'CREATE', module: 'Fournisseurs',
    description: 'Création fournisseur: 3K IMPORT/EXPORT',
    entity_type: 'Fournisseur', entity_id: 'FOU-001',
    new_value: { raison_sociale: '3K IMPORT/EXPORT' },
  },
  {
    id: '4', timestamp: '2026-08-27 08:15:45',
    user_id: '3', user_name: 'M. Traoré',
    action: 'IMPORT', module: 'Articles',
    description: 'Importation de 125 articles depuis Excel',
    entity_type: 'Import',
    new_value: { nombre_articles: 125, fichier: 'ETAT_LISTEARTICLE.xls' },
  },
  {
    id: '5', timestamp: '2026-08-26 17:30:00',
    user_id: '2', user_name: 'Mme. Koné',
    action: 'PAYMENT', module: 'Trésorerie',
    description: 'Enregistrement recette: 425000 FCFA',
    entity_type: 'Operation',
    new_value: { montant: 425000, type: 'RECETTE' },
  },
];

export const useAuditStore = create<AuditState>((set, get) => ({
  logs: MOCK_LOGS,
  filtreUser: 'Tous',
  filtreModule: 'Tous',
  filtreDateDebut: '',
  filtreDateFin: '',

  addLog: (logData) => {
    const newLog: AuditLog = {
      ...logData,
      id: Date.now().toString(),
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    };
    set({ logs: [newLog, ...get().logs] });
  },

  getLogsFiltres: () => {
    const { logs, filtreUser, filtreModule, filtreDateDebut, filtreDateFin } = get();
    return logs.filter(log => {
      const matchUser = filtreUser === 'Tous' || log.user_name === filtreUser;
      const matchModule = filtreModule === 'Tous' || log.module === filtreModule;
      let matchDate = true;
      if (filtreDateDebut) {
        matchDate = matchDate && log.timestamp >= filtreDateDebut;
      }
      if (filtreDateFin) {
        matchDate = matchDate && log.timestamp <= filtreDateFin + ' 23:59:59';
      }
      return matchUser && matchModule && matchDate;
    });
  },

  clearLogs: () => {
    if (confirm('⚠️ Êtes-vous sûr de vouloir supprimer tous les logs d\'audit ?')) {
      set({ logs: [] });
    }
  },

  setFiltres: (filters) => set(filters),
}));
