export type ModePaiement = 'ESPECES' | 'MOBILE_MONEY' | 'CHEQUE' | 'CREDIT_CLIENT';
export type StatutVente = 'BROUILLON' | 'VALIDEE' | 'ANNULEE';

export interface LigneVente {
  id: string;
  article_id: string;
  designation: string;
  prix_unitaire: number;
  quantite: number;
  remise_pct: number;
  total_ht: number;
  total_ttc: number;
}

export interface Vente {
  id: string;
  numero: string;
  date_vente: string;
  client_id?: string;
  client_nom: string;
  lignes: LigneVente[];
  total_ht: number;
  total_tva: number;
  total_remise: number;
  total_ttc: number;
  mode_paiement: ModePaiement;
  statut: StatutVente;
  depot_id: string;
  utilisateur_id: string;
}