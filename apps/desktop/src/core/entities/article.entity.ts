export interface Article {
  id: string;
  code_auto: string;
  reference: string;
  designation: string;
  famille: string;
  sous_famille?: string;
  prix_achat: number;
  prix_vente_ttc: number;
  prix_vip?: number;
  tva: number;
  stock: number;
  stock_min: number;
  image_url?: string;
  depot: string;
}

export type FamilleArticle = 
  | 'Sanitaire'
  | 'Plomberie'
  | 'Électricité'
  | 'Outillage'
  | 'Quincaillerie'
  | 'Ciment'
  | 'Peinture';