import { create } from 'zustand';

// ============ TYPES ============
export type TypeMouvement = 'ENTREE_ACHAT' | 'SORTIE_VENTE' | 'SORTIE_DESTOCKAGE' | 'TRANSFERT_ENTREE' | 'TRANSFERT_SORTIE' | 'INVENTAIRE' | 'AJUSTEMENT' | 'RETOUR_CLIENT' | 'CASSERIE' | 'PRODUCTION_ENTREE' | 'PRODUCTION_SORTIE';

export interface FamilleArticle {
  id: string;
  code: string;
  nom: string;
  description?: string;
  est_active: boolean;
  date_creation: string;
}

export interface Article {
  id: string;
  code: string;
  designation: string;
  famille: string;
  sous_famille?: string;
  prix_achat: number;
  prix_vente: number;
  prix_vip?: number;
  tva: number;
  stock_min: number;
  stock_max: number;
  unite: string;
  conditionnement?: string;
  date_creation: string;
}

export interface StockDepot {
  id: string;
  article_id: string;
  depot_id: string;
  quantite: number;
  quantite_reservee: number;
  quantite_disponible: number;
  cout_moyen: number;
  date_dernier_mouvement: string;
}

export interface MouvementStock {
  id: string;
  article_id: string;
  depot_id: string;
  type: TypeMouvement;
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  cout_unitaire: number;
  reference: string;
  motif: string;
  utilisateur: string;
  date: string;
  heure: string;
  filiale_id?: string;
}

export interface Depot {
  id: string;
  code: string;
  nom: string;
  adresse: string;
  responsable: string;
  filiale_id: string;
  est_actif: boolean;
}

export interface EntreeStock {
  id: string;
  numero: string;
  depot_id: string;
  date_reception: string;
  conditionnement: string;
  destination: string;
  numero_bl: string;
  fournisseur_id?: string;
  fournisseur_nom: string;
  frais_transport: number;
  information: string;
  lignes: any[];
  total: number;
  nombre_articles: number;
  nombre_colis: number;
  utilisateur: string;
  date_creation: string;
}

export interface SortieStock {
  id: string;
  numero: string;
  depot_id: string;
  date_sortie: string;
  conditionnement: string;
  numero_bs: string;
  service: string;
  lignes: any[];
  nombre_articles: number;
  nombre_colis: number;
  total: number;
  utilisateur: string;
  date_creation: string;
}

export interface TransfertStock {
  id: string;
  numero: string;
  depot_source_id: string;
  depot_destination_id: string;
  date_transfert: string;
  information: string;
  conditionnement: string;
  lignes: any[];
  nombre_articles: number;
  nombre_colis: number;
  total: number;
  utilisateur: string;
  date_creation: string;
  type: 'INTER_DEPOT' | 'INTER_FILIALE';
}

export interface Production {
  id: string;
  numero: string;
  depot_id: string;
  date_saisie: string;
  equipe: string;
  date_debut: string;
  heure_debut: string;
  date_fin: string;
  heure_fin: string;
  petrissage_debut: string;
  petrissage_fin: string;
  faconnage_debut: string;
  faconnage_fin: string;
  enfournement_debut: string;
  enfournement_fin: string;
  nombre_boules: number;
  nombre_pattes_calculee: number;
  nombre_pattes_comptee: number;
  nombre_pattes_retour: number;
  matieres_premieres: any[];
  articles_produits: any[];
  commentaire: string;
  utilisateur: string;
}

export interface Inventaire {
  id: string;
  numero: string;
  depot_id: string;
  date: string;
  statut: 'EN_COURS' | 'TERMINE' | 'VALIDE';
  lignes: any[];
  utilisateur: string;
  notes?: string;
}

// ============ STATE ============
interface StockState {
  articles: Article[];
  stocks: StockDepot[];
  mouvements: MouvementStock[];
  depots: Depot[];
  familles: FamilleArticle[]; // <-- AJOUTÉ
  entrees: EntreeStock[];
  sorties: SortieStock[];
  transferts: TransfertStock[];
  productions: Production[];
  inventaires: Inventaire[];
  
  recherche: string;
  familleFiltre: string;
  depotFiltre: string;
  statutFiltre: string;
  articleSelectionne: Article | null;
  
  setRecherche: (q: string) => void;
  setFamilleFiltre: (f: string) => void;
  setDepotFiltre: (d: string) => void;
  setStatutFiltre: (s: string) => void;
  setArticleSelectionne: (a: Article | null) => void;
  
  addArticle: (data: Omit<Article, 'id' | 'date_creation'>) => void;
  updateArticle: (id: string, data: Partial<Article>) => void;
  deleteArticle: (id: string) => void;
  getArticlesFiltres: () => Article[];
  
  addFamille: (data: Omit<FamilleArticle, 'id' | 'date_creation'>) => void;
  updateFamille: (id: string, data: Partial<FamilleArticle>) => void;
  deleteFamille: (id: string) => void;
  getFamillesActives: () => FamilleArticle[];
  
  getStockByArticleDepot: (articleId: string, depotId: string) => StockDepot | undefined;
  getStockTotalByArticle: (articleId: string) => number;
  getStockDisponibleByArticle: (articleId: string) => number;
  
  ajouterMouvement: (data: Omit<MouvementStock, 'id' | 'quantite_avant' | 'quantite_apres' | 'date' | 'heure'>) => void;
  getMouvementsByArticle: (articleId: string) => MouvementStock[];
  getMouvementsByDepot: (depotId: string) => MouvementStock[];
  
  transfererStock: (articleId: string, depotOrigine: string, depotDestination: string, quantite: number, motif: string, utilisateur: string) => void;
  
  creerEntreeStock: (data: Omit<EntreeStock, 'id' | 'numero' | 'date_creation'>) => void;
  creerSortieStock: (data: Omit<SortieStock, 'id' | 'numero' | 'date_creation'>) => void;
  creerTransfert: (data: Omit<TransfertStock, 'id' | 'numero' | 'date_creation'>) => void;
  creerProduction: (data: Omit<Production, 'id' | 'numero'>) => void;
  
  creerInventaire: (data: Omit<Inventaire, 'id' | 'numero'>) => void;
  validerInventaire: (inventaireId: string) => void;
  
  importArticles: (data: Array<{code: string, designation: string, prix_achat: number, prix_vente: number, famille: string}>) => void;
  
  getValeurStockTotal: () => number;
  getNombreAlertes: () => number;
  getArticlesEnRupture: () => Article[];
  getArticlesStockFaible: () => Article[];
  getTopArticles: () => Array<{article: Article, quantite: number}>;
}

// ============ MOCK DATA ============
const FAMILLES_MOCK: FamilleArticle[] = [
  { id: '1', code: 'CAR', nom: 'CARREAU', description: 'Carrelages et revêtements de sol', est_active: true, date_creation: '2024-01-01' },
  { id: '2', code: 'PLO', nom: 'PLOMBERIE', description: 'Articles de plomberie', est_active: true, date_creation: '2024-01-01' },
  { id: '3', code: 'PEI', nom: 'PEINTURE', description: 'Peintures et accessoires', est_active: true, date_creation: '2024-01-01' },
  { id: '4', code: 'ELE', nom: 'ELECTRICITE', description: 'Matériel électrique', est_active: true, date_creation: '2024-01-01' },
  { id: '5', code: 'DIV', nom: 'DIVERS', description: 'Articles divers', est_active: true, date_creation: '2024-01-01' },
  { id: '6', code: 'SAN', nom: 'SANITAIRE', description: 'Articles sanitaires', est_active: true, date_creation: '2024-01-01' },
  { id: '7', code: 'OUT', nom: 'OUTILLAGE', description: 'Outils et outillage', est_active: true, date_creation: '2024-01-01' },
  { id: '8', code: 'QUI', nom: 'QUINCAILLERIE', description: 'Quincaillerie générale', est_active: true, date_creation: '2024-01-01' },
];

const DEPOTS_MOCK: Depot[] = [
  { id: '1', code: 'DEP-001', nom: 'Dépôt Principal', adresse: 'Zone industrielle, Abidjan', responsable: 'M. Koné', filiale_id: '1', est_actif: true },
  { id: '2', code: 'DEP-002', nom: 'Dépôt Niakara', adresse: 'Niakara, Abidjan', responsable: 'M. Traoré', filiale_id: '1', est_actif: true },
  { id: '3', code: 'DEP-003', nom: 'Dépôt Plastic', adresse: 'Plastic City', responsable: 'M. Diabaté', filiale_id: '1', est_actif: true },
  { id: '4', code: 'DEP-004', nom: 'Dépôt Central', adresse: 'Centre-ville', responsable: 'M. Cissé', filiale_id: '1', est_actif: true },
];

const ARTICLES_MOCK: Article[] = [
  { id: '1', code: '01408202625001', designation: '250001 METRE CARREAU 25/40', famille: 'CARREAU', prix_achat: 2166, prix_vente: 2500, tva: 18, stock_min: 50, stock_max: 500, unite: 'M²', date_creation: '2024-01-15' },
  { id: '2', code: '214082026N', designation: '360000 METRE CARREAU 30/60', famille: 'CARREAU', prix_achat: 3784, prix_vente: 4000, tva: 18, stock_min: 30, stock_max: 300, unite: 'M²', date_creation: '2024-01-15' },
  { id: '3', code: 'ABAT3', designation: 'ABATTANT WC INDUSTRAP', famille: 'PLOMBERIE', prix_achat: 1080, prix_vente: 1100, tva: 18, stock_min: 20, stock_max: 200, unite: 'PIECE', date_creation: '2024-02-01' },
  { id: '4', code: 'ABAT4', designation: 'ABATTANT WC LUX', famille: 'PLOMBERIE', prix_achat: 1500, prix_vente: 1600, tva: 18, stock_min: 15, stock_max: 150, unite: 'PIECE', date_creation: '2024-02-01' },
  { id: '5', code: '10122024AC', designation: 'ACAJOU 50L', famille: 'PEINTURE', prix_achat: 2200, prix_vente: 2200, tva: 18, stock_min: 10, stock_max: 100, unite: 'BIDON', date_creation: '2024-03-10' },
  { id: '6', code: 'AMP1', designation: 'AMPOULE 0.60', famille: 'ELECTRICITE', prix_achat: 500, prix_vente: 600, tva: 18, stock_min: 100, stock_max: 1000, unite: 'PIECE', date_creation: '2024-03-15' },
  { id: '7', code: 'AGR10', designation: 'AGRIFFE 10/12', famille: 'DIVERS', prix_achat: 2500, prix_vente: 3000, tva: 18, stock_min: 50, stock_max: 500, unite: 'PIECE', date_creation: '2024-04-01' },
];

const STOCKS_MOCK: StockDepot[] = [
  { id: '1', article_id: '1', depot_id: '1', quantite: 250, quantite_reservee: 20, quantite_disponible: 230, cout_moyen: 2166, date_dernier_mouvement: '2026-08-27' },
  { id: '2', article_id: '1', depot_id: '2', quantite: 150, quantite_reservee: 10, quantite_disponible: 140, cout_moyen: 2166, date_dernier_mouvement: '2026-08-26' },
  { id: '3', article_id: '3', depot_id: '1', quantite: 45, quantite_reservee: 5, quantite_disponible: 40, cout_moyen: 1080, date_dernier_mouvement: '2026-08-27' },
  { id: '4', article_id: '3', depot_id: '3', quantite: 0, quantite_reservee: 0, quantite_disponible: 0, cout_moyen: 1080, date_dernier_mouvement: '2026-08-20' },
  { id: '5', article_id: '6', depot_id: '1', quantite: 8, quantite_reservee: 0, quantite_disponible: 8, cout_moyen: 500, date_dernier_mouvement: '2026-08-27' },
];

const MOUVEMENTS_MOCK: MouvementStock[] = [
  { id: '1', article_id: '1', depot_id: '1', type: 'ENTREE_ACHAT', quantite: 100, quantite_avant: 150, quantite_apres: 250, cout_unitaire: 2166, reference: 'FA-2026-001', motif: 'Réception achat', utilisateur: 'M. Koné', date: '2026-08-27', heure: '09:30' },
  { id: '2', article_id: '3', depot_id: '1', type: 'SORTIE_VENTE', quantite: 5, quantite_avant: 50, quantite_apres: 45, cout_unitaire: 1080, reference: 'VTE-2026-147', motif: 'Vente client', utilisateur: 'Caissier', date: '2026-08-27', heure: '10:15' },
  { id: '3', article_id: '1', depot_id: '1', type: 'TRANSFERT_SORTIE', quantite: 50, quantite_avant: 300, quantite_apres: 250, cout_unitaire: 2166, reference: 'TRF-2026-001', motif: 'Transfert vers Dépôt Niakara', utilisateur: 'M. Koné', date: '2026-08-26', heure: '14:00' },
];

// ============ STORE ============
export const useStockStore = create<StockState>((set, get) => ({
  articles: ARTICLES_MOCK,
  stocks: STOCKS_MOCK,
  mouvements: MOUVEMENTS_MOCK,
  depots: DEPOTS_MOCK,
  familles: FAMILLES_MOCK, // <-- INITIALISATION CORRECTE ICI
  entrees: [],
  sorties: [],
  transferts: [],
  productions: [],
  inventaires: [],
  
  recherche: '',
  familleFiltre: 'Toutes',
  depotFiltre: 'Tous',
  statutFiltre: 'Tous',
  articleSelectionne: null,

  setRecherche: (q) => set({ recherche: q }),
  setFamilleFiltre: (f) => set({ familleFiltre: f }),
  setDepotFiltre: (d) => set({ depotFiltre: d }),
  setStatutFiltre: (s) => set({ statutFiltre: s }),
  setArticleSelectionne: (a) => set({ articleSelectionne: a }),

  addArticle: (data) => {
    const newArticle: Article = { ...data, id: Date.now().toString(), date_creation: new Date().toISOString().split('T')[0] };
    set({ articles: [...get().articles, newArticle] });
  },

  updateArticle: (id, data) => {
    set({ articles: get().articles.map(a => a.id === id ? { ...a, ...data } : a) });
  },

  deleteArticle: (id) => {
    if (confirm('⚠️ Supprimer cet article ?')) {
      set({ articles: get().articles.filter(a => a.id !== id) });
    }
  },

  addFamille: (data) => {
    const newFamille: FamilleArticle = {
      ...data,
      id: Date.now().toString(),
      date_creation: new Date().toISOString().split('T')[0],
    };
    set({ familles: [...get().familles, newFamille] });
  },

  updateFamille: (id, data) => {
    set({ familles: get().familles.map(f => f.id === id ? { ...f, ...data } : f) });
  },

  deleteFamille: (id) => {
    const famille = get().familles.find(f => f.id === id);
    if (!famille) return;
    const articlesUtilisant = get().articles.filter(a => a.famille === famille.nom);
    if (articlesUtilisant.length > 0) {
      alert(`⚠️ Impossible de supprimer : ${articlesUtilisant.length} article(s) utilisent cette famille`);
      return;
    }
    if (confirm('Supprimer cette famille ?')) {
      set({ familles: get().familles.filter(f => f.id !== id) });
    }
  },

  getFamillesActives: () => {
    return get().familles.filter(f => f.est_active);
  },

  getArticlesFiltres: () => {
    const { articles, recherche, familleFiltre, depotFiltre, statutFiltre } = get();
    return articles.filter(a => {
      const matchRecherche = a.designation.toLowerCase().includes(recherche.toLowerCase()) || a.code.toLowerCase().includes(recherche.toLowerCase());
      const matchFamille = familleFiltre === 'Toutes' || a.famille === familleFiltre;
      
      let matchDepot = true;
      if (depotFiltre !== 'Tous') {
        const stockDepot = get().stocks.find(s => s.article_id === a.id && s.depot_id === depotFiltre);
        matchDepot = stockDepot !== undefined;
      }
      
      const stockTotal = get().getStockTotalByArticle(a.id);
      let matchStatut = true;
      if (statutFiltre === 'En stock') matchStatut = stockTotal > a.stock_min;
      if (statutFiltre === 'Stock faible') matchStatut = stockTotal > 0 && stockTotal <= a.stock_min;
      if (statutFiltre === 'Rupture') matchStatut = stockTotal === 0;
      
      return matchRecherche && matchFamille && matchDepot && matchStatut;
    });
  },

  getStockByArticleDepot: (articleId, depotId) => {
    return get().stocks.find(s => s.article_id === articleId && s.depot_id === depotId);
  },

  getStockTotalByArticle: (articleId) => {
    return get().stocks.filter(s => s.article_id === articleId).reduce((sum, s) => sum + s.quantite, 0);
  },

  getStockDisponibleByArticle: (articleId) => {
    return get().stocks.filter(s => s.article_id === articleId).reduce((sum, s) => sum + s.quantite_disponible, 0);
  },

  ajouterMouvement: (data) => {
    const stock = get().stocks.find(s => s.article_id === data.article_id && s.depot_id === data.depot_id);
    const quantiteAvant = stock?.quantite || 0;
    let quantiteApres = quantiteAvant;
    
    if (data.type === 'ENTREE_ACHAT' || data.type === 'TRANSFERT_ENTREE' || data.type === 'RETOUR_CLIENT' || data.type === 'PRODUCTION_ENTREE') {
      quantiteApres = quantiteAvant + data.quantite;
    } else if (data.type === 'SORTIE_VENTE' || data.type === 'TRANSFERT_SORTIE' || data.type === 'CASSERIE' || data.type === 'SORTIE_DESTOCKAGE' || data.type === 'PRODUCTION_SORTIE') {
      quantiteApres = Math.max(0, quantiteAvant - data.quantite);
    } else if (data.type === 'INVENTAIRE' || data.type === 'AJUSTEMENT') {
      quantiteApres = data.quantite;
    }

    const newMouvement: MouvementStock = {
      ...data,
      id: Date.now().toString(),
      quantite_avant: quantiteAvant,
      quantite_apres: quantiteApres,
      date: new Date().toISOString().split('T')[0],
      heure: new Date().toTimeString().slice(0, 5),
    };

    if (stock) {
      set({
        stocks: get().stocks.map(s => 
          s.id === stock.id 
            ? { ...s, quantite: quantiteApres, quantite_disponible: quantiteApres - s.quantite_reservee, date_dernier_mouvement: newMouvement.date }
            : s
        ),
        mouvements: [...get().mouvements, newMouvement],
      });
    } else {
      const newStock: StockDepot = {
        id: Date.now().toString(),
        article_id: data.article_id,
        depot_id: data.depot_id,
        quantite: quantiteApres,
        quantite_reservee: 0,
        quantite_disponible: quantiteApres,
        cout_moyen: data.cout_unitaire,
        date_dernier_mouvement: newMouvement.date,
      };
      set({ stocks: [...get().stocks, newStock], mouvements: [...get().mouvements, newMouvement] });
    }
  },

  getMouvementsByArticle: (articleId) => {
    return get().mouvements.filter(m => m.article_id === articleId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  getMouvementsByDepot: (depotId) => {
    return get().mouvements.filter(m => m.depot_id === depotId).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  },

  transfererStock: (articleId, depotOrigine, depotDestination, quantite, motif, utilisateur) => {
    get().ajouterMouvement({
      article_id: articleId, depot_id: depotOrigine, type: 'TRANSFERT_SORTIE', quantite,
      cout_unitaire: 0, reference: `TRF-${Date.now()}`, motif, utilisateur,
    });
    get().ajouterMouvement({
      article_id: articleId, depot_id: depotDestination, type: 'TRANSFERT_ENTREE', quantite,
      cout_unitaire: 0, reference: `TRF-${Date.now()}`, motif, utilisateur,
    });
  },

  creerEntreeStock: (data) => {
    const newEntree: EntreeStock = {
      ...data,
      id: Date.now().toString(),
      numero: `ENT-${new Date().getFullYear()}-${String(get().entrees.length + 1).padStart(4, '0')}`,
      date_creation: new Date().toISOString().split('T')[0],
    };
    set({ entrees: [...get().entrees, newEntree] });
    
    data.lignes.forEach((ligne: any) => {
      get().ajouterMouvement({
        article_id: ligne.article_id,
        depot_id: data.depot_id,
        type: 'ENTREE_ACHAT',
        quantite: ligne.quantite,
        cout_unitaire: ligne.prix_achat_ttc,
        reference: newEntree.numero,
        motif: `Entrée achat - ${data.fournisseur_nom}`,
        utilisateur: data.utilisateur,
      });
    });
  },

  creerSortieStock: (data) => {
    const newSortie: SortieStock = {
      ...data,
      id: Date.now().toString(),
      numero: `SOR-${new Date().getFullYear()}-${String(get().sorties.length + 1).padStart(4, '0')}`,
      date_creation: new Date().toISOString().split('T')[0],
    };
    set({ sorties: [...get().sorties, newSortie] });
    
    data.lignes.forEach((ligne: any) => {
      get().ajouterMouvement({
        article_id: ligne.article_id,
        depot_id: data.depot_id,
        type: 'SORTIE_DESTOCKAGE',
        quantite: ligne.quantite,
        cout_unitaire: ligne.cmup,
        reference: newSortie.numero,
        motif: `Sortie stock - ${data.service}`,
        utilisateur: data.utilisateur,
      });
    });
  },

  creerTransfert: (data) => {
    const newTransfert: TransfertStock = {
      ...data,
      id: Date.now().toString(),
      numero: `TRF-${new Date().getFullYear()}-${String(get().transferts.length + 1).padStart(4, '0')}`,
      date_creation: new Date().toISOString().split('T')[0],
    };
    set({ transferts: [...get().transferts, newTransfert] });
    
    data.lignes.forEach((ligne: any) => {
      get().transfererStock(
        ligne.article_id,
        data.depot_source_id,
        data.depot_destination_id,
        ligne.quantite,
        `Transfert ${data.type === 'INTER_FILIALE' ? 'inter-filiale' : 'inter-dépôt'} - ${data.information}`,
        data.utilisateur
      );
    });
  },

  creerProduction: (data) => {
    const newProduction: Production = {
      ...data,
      id: Date.now().toString(),
      numero: `PROD-${new Date().getFullYear()}-${String(get().productions.length + 1).padStart(4, '0')}`,
    };
    set({ productions: [...get().productions, newProduction] });
    
    data.matieres_premieres.forEach((mp: any) => {
      get().ajouterMouvement({
        article_id: mp.article_id,
        depot_id: data.depot_id,
        type: 'PRODUCTION_SORTIE',
        quantite: mp.quantite,
        cout_unitaire: 0,
        reference: newProduction.numero,
        motif: 'Matière première utilisée',
        utilisateur: data.utilisateur,
      });
    });
    
    data.articles_produits.forEach((ap: any) => {
      if (ap.qte_produite > 0) {
        get().ajouterMouvement({
          article_id: ap.article_id,
          depot_id: data.depot_id,
          type: 'PRODUCTION_ENTREE',
          quantite: ap.qte_produite,
          cout_unitaire: 0,
          reference: newProduction.numero,
          motif: 'Article produit',
          utilisateur: data.utilisateur,
        });
      }
    });
  },

  creerInventaire: (data) => {
    const newInventaire: Inventaire = {
      ...data,
      id: Date.now().toString(),
      numero: `INV-${new Date().getFullYear()}-${String(get().inventaires.length + 1).padStart(4, '0')}`,
    };
    set({ inventaires: [...get().inventaires, newInventaire] });
  },

  validerInventaire: (inventaireId) => {
    const inventaire = get().inventaires.find(i => i.id === inventaireId);
    if (!inventaire) return;

    inventaire.lignes.forEach((ligne: any) => {
      if (ligne.ecart !== 0) {
        get().ajouterMouvement({
          article_id: ligne.article_id,
          depot_id: inventaire.depot_id,
          type: 'INVENTAIRE',
          quantite: ligne.quantite_reelle,
          cout_unitaire: 0,
          reference: inventaire.numero,
          motif: ligne.motif_ecart || 'Ajustement inventaire',
          utilisateur: inventaire.utilisateur,
        });
      }
    });

    set({
      inventaires: get().inventaires.map(i => i.id === inventaireId ? { ...i, statut: 'VALIDE' as const } : i),
    });
  },

  importArticles: (data) => {
    const newArticles: Article[] = data.map((d, idx) => ({
      id: `import-${Date.now()}-${idx}`,
      code: d.code,
      designation: d.designation,
      famille: d.famille,
      prix_achat: d.prix_achat,
      prix_vente: d.prix_vente,
      tva: 18,
      stock_min: 10,
      stock_max: 100,
      unite: 'PIECE',
      date_creation: new Date().toISOString().split('T')[0],
    }));
    set({ articles: [...get().articles, ...newArticles] });
  },

  getValeurStockTotal: () => {
    return get().stocks.reduce((sum, s) => {
      const article = get().articles.find(a => a.id === s.article_id);
      return sum + (s.quantite * (article?.prix_achat || 0));
    }, 0);
  },

  getNombreAlertes: () => {
    return get().articles.filter(a => {
      const stock = get().getStockTotalByArticle(a.id);
      return stock <= a.stock_min;
    }).length;
  },

  getArticlesEnRupture: () => {
    return get().articles.filter(a => get().getStockTotalByArticle(a.id) === 0);
  },

  getArticlesStockFaible: () => {
    return get().articles.filter(a => {
      const stock = get().getStockTotalByArticle(a.id);
      return stock > 0 && stock <= a.stock_min;
    });
  },

  getTopArticles: () => {
    const mouvements = get().mouvements.filter(m => m.type === 'SORTIE_VENTE');
    const articleQuantites = mouvements.reduce((acc, m) => {
      acc[m.article_id] = (acc[m.article_id] || 0) + m.quantite;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(articleQuantites)
      .map(([articleId, quantite]) => ({
        article: get().articles.find(a => a.id === articleId)!,
        quantite,
      }))
      .filter(x => x.article)
      .sort((a, b) => b.quantite - a.quantite)
      .slice(0, 10);
  },
}));
