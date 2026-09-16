import { create } from 'zustand';
import { Article } from '../../core/entities/article.entity';

export interface Entrepot {
  id: string;
  code: string;
  nom: string;
  adresse: string;
  responsable: string;
  est_actif: boolean;
}

interface ArticlesState {
  articles: Article[];
  entrepots: Entrepot[];
  familleFiltre: string;
  entrepotFiltre: string;
  statutFiltre: string;
  recherche: string;
  articleSelectionne: Article | null;
  entrepotSelectionne: string;

  setFamilleFiltre: (famille: string) => void;
  setEntrepotFiltre: (entrepot: string) => void;
  setStatutFiltre: (statut: string) => void;
  setRecherche: (recherche: string) => void;
  setArticleSelectionne: (article: Article | null) => void;
  setEntrepotSelectionne: (entrepotId: string) => void;
  getArticlesFiltres: () => Article[];
  
  // Gestion des articles
  addArticle: (article: Omit<Article, 'id'>) => void;
  updateArticle: (id: string, data: Partial<Article>) => void;
  deleteArticle: (id: string) => void;
  
  // Gestion du stock - AJOUTER à la quantité existante
  ajouterStock: (articleId: string, quantite: number, entrepotId: string, motif: string) => void;
  retirerStock: (articleId: string, quantite: number, entrepotId: string, motif: string) => void;
  
  // Gestion des entrepôts
  addEntrepot: (entrepot: Omit<Entrepot, 'id' | 'code'>) => void;
  updateEntrepot: (id: string, data: Partial<Entrepot>) => void;
  deleteEntrepot: (id: string) => void;
  
  // Import Excel
  importArticles: (articlesData: Array<{
    code: string;
    designation: string;
    prix_achat: number;
    prix_vente: number;
    famille: string;
  }>) => void;
}

const ENTREPOTS_MOCK: Entrepot[] = [
  { id: '1', code: 'ENT-001', nom: 'Entrepôt Principal', adresse: 'Zone industrielle, Abidjan', responsable: 'M. Koné', est_actif: true },
  { id: '2', code: 'ENT-002', nom: 'Entrepôt Secondaire', adresse: 'Cocody, Abidjan', responsable: 'M. Traoré', est_actif: true },
  { id: '3', code: 'ENT-003', nom: 'Dépôt Livraison', adresse: 'Yopougon, Abidjan', responsable: 'M. Diabaté', est_actif: true },
];

const ARTICLES_BASE: Article[] = [
  {
    id: '1', code_auto: 'ABAT3', reference: 'ABAT3',
    designation: 'Abattant WC Industap', famille: 'Sanitaire',
    prix_achat: 1080, prix_vente_ttc: 1100, prix_vip: 1000,
    tva: 18, stock: 45, stock_min: 10, depot: 'ENT-001',
  },
  {
    id: '2', code_auto: 'ABAT4', reference: 'ABAT4',
    designation: 'Abattant WC Lux', famille: 'Sanitaire',
    prix_achat: 1500, prix_vente_ttc: 1600, prix_vip: 1400,
    tva: 18, stock: 28, stock_min: 10, depot: 'ENT-001',
  },
];

export const useArticlesStore = create<ArticlesState>((set, get) => ({
  articles: ARTICLES_BASE,
  entrepots: ENTREPOTS_MOCK,
  familleFiltre: 'Tous',
  entrepotFiltre: 'Tous',
  statutFiltre: 'Tous',
  recherche: '',
  articleSelectionne: null,
  entrepotSelectionne: 'ENT-001',

  setFamilleFiltre: (famille) => set({ familleFiltre: famille }),
  setEntrepotFiltre: (entrepot) => set({ entrepotFiltre: entrepot }),
  setStatutFiltre: (statut) => set({ statutFiltre: statut }),
  setRecherche: (recherche) => set({ recherche }),
  setArticleSelectionne: (article) => set({ articleSelectionne: article }),
  setEntrepotSelectionne: (entrepotId) => set({ entrepotSelectionne: entrepotId }),

  getArticlesFiltres: () => {
    const { articles, familleFiltre, entrepotFiltre, statutFiltre, recherche } = get();
    return articles.filter(a => {
      const matchFamille = familleFiltre === 'Tous' || a.famille === familleFiltre;
      const matchEntrepot = entrepotFiltre === 'Tous' || a.depot === entrepotFiltre;
      const matchRecherche = a.designation.toLowerCase().includes(recherche.toLowerCase()) ||
                            a.code_auto.toLowerCase().includes(recherche.toLowerCase());
      let matchStatut = true;
      if (statutFiltre === 'En stock') matchStatut = a.stock > a.stock_min;
      if (statutFiltre === 'Stock faible') matchStatut = a.stock > 0 && a.stock <= a.stock_min;
      if (statutFiltre === 'Rupture') matchStatut = a.stock === 0;
      return matchFamille && matchEntrepot && matchStatut && matchRecherche;
    });
  },

  addArticle: (articleData) => {
    const newArticle: Article = { ...articleData, id: Date.now().toString() };
    set({ articles: [...get().articles, newArticle] });
  },

  updateArticle: (id, data) => {
    set({
      articles: get().articles.map(a =>
        a.id === id ? { ...a, ...data } : a
      ),
    });
  },

  deleteArticle: (id) => {
    set({ articles: get().articles.filter(a => a.id !== id) });
  },

  // AJOUTER au stock existant (pas remplacer)
  ajouterStock: (articleId, quantite, entrepotId, motif) => {
    set({
      articles: get().articles.map(a => {
        if (a.id === articleId && a.depot === entrepotId) {
          return { ...a, stock: a.stock + quantite };
        }
        return a;
      }),
    });
    // TODO: Enregistrer dans le journal d'audit
    console.log(`[AUDIT] Ajout stock: ${quantite} unités à ${articleId} (${motif})`);
  },

  retirerStock: (articleId, quantite, entrepotId, motif) => {
    set({
      articles: get().articles.map(a => {
        if (a.id === articleId && a.depot === entrepotId) {
          const nouveauStock = Math.max(0, a.stock - quantite);
          return { ...a, stock: nouveauStock };
        }
        return a;
      }),
    });
    // TODO: Enregistrer dans le journal d'audit
    console.log(`[AUDIT] Retrait stock: ${quantite} unités de ${articleId} (${motif})`);
  },

  addEntrepot: (data) => {
    const newEntrepot: Entrepot = {
      ...data,
      id: Date.now().toString(),
      code: `ENT-${String(get().entrepots.length + 1).padStart(3, '0')}`,
    };
    set({ entrepots: [...get().entrepots, newEntrepot] });
  },

  updateEntrepot: (id, data) => {
    set({
      entrepots: get().entrepots.map(e => e.id === id ? { ...e, ...data } : e),
    });
  },

  deleteEntrepot: (id) => {
    set({ entrepots: get().entrepots.filter(e => e.id !== id) });
  },

  importArticles: (articlesData) => {
    const newArticles: Article[] = articlesData.map((data, index) => ({
      id: `import-${Date.now()}-${index}`,
      code_auto: data.code,
      reference: data.code,
      designation: data.designation,
      famille: data.famille,
      prix_achat: data.prix_achat,
      prix_vente_ttc: data.prix_vente,
      prix_vip: data.prix_vente * 0.95,
      tva: 18,
      stock: 0,
      stock_min: 10,
      depot: get().entrepotSelectionne,
    }));
    set({ articles: [...get().articles, ...newArticles] });
  },
}));
