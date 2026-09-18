import { create } from 'zustand';
import type { Client } from '../../core/clients';
import { ajouterAuPanier, type LignePanier } from '../../core/ventes';
import type { Article } from '../../core/articles';

interface POSState {
  lignes: LignePanier[];
  /** Client du ticket en cours ; null = client comptoir. */
  client: Client | null;
  remiseGlobale: number;
  familleId: string;
  recherche: string;
  /** Proforma en cours de facturation (n° affiché, passe FACTUREE à l'encaissement). */
  proforma: { id: string; numero: string } | null;

  setClient: (client: Client | null) => void;
  setRemiseGlobale: (remise: number) => void;
  setFamilleId: (id: string) => void;
  setRecherche: (recherche: string) => void;

  ajouterArticle: (article: Article, quantite?: number, prixVip?: boolean) => void;
  modifierQuantite: (articleId: string, quantite: number) => void;
  modifierRemiseLigne: (articleId: string, remise: number) => void;
  supprimerLigne: (articleId: string) => void;
  viderPanier: () => void;
  /** Remplace le ticket par les lignes d'une proforma (client et remise compris). */
  chargerProforma: (proforma: { id: string; numero: string }, lignes: LignePanier[], client: Client | null, remiseGlobale: number) => void;
}

/** État du ticket en cours (UI uniquement ; la persistance se fait à la validation). */
export const usePOSStore = create<POSState>((set, get) => ({
  lignes: [],
  client: null,
  remiseGlobale: 0,
  familleId: '',
  recherche: '',
  proforma: null,

  // Choisir un client en compte applique d'office sa remise commerciale (modifiable ensuite).
  setClient: (client) => set({ client, remiseGlobale: client ? client.remise_percent : 0 }),
  setRemiseGlobale: (remise) => set({ remiseGlobale: Math.min(Math.max(remise, 0), 100) }),
  setFamilleId: (familleId) => set({ familleId }),
  setRecherche: (recherche) => set({ recherche }),

  ajouterArticle: (article, quantite = 1, prixVip = false) =>
    set({
      lignes: ajouterAuPanier(get().lignes, {
        article_id: article.id,
        code: article.code,
        designation: article.designation,
        unite: article.unite,
        prix_unitaire_ttc: prixVip && article.prix_vip != null ? article.prix_vip : article.prix_vente,
        tva_percent: article.tva,
        quantite,
        remise_percent: 0,
      }),
    }),

  modifierQuantite: (articleId, quantite) => {
    if (quantite <= 0) { get().supprimerLigne(articleId); return; }
    set({ lignes: get().lignes.map((l) => (l.article_id === articleId ? { ...l, quantite } : l)) });
  },

  modifierRemiseLigne: (articleId, remise) =>
    set({ lignes: get().lignes.map((l) => (l.article_id === articleId ? { ...l, remise_percent: Math.min(Math.max(remise, 0), 100) } : l)) }),

  supprimerLigne: (articleId) => set({ lignes: get().lignes.filter((l) => l.article_id !== articleId) }),

  viderPanier: () => set({ lignes: [], client: null, remiseGlobale: 0, proforma: null }),
  chargerProforma: (proforma, lignes, client, remiseGlobale) => set({ proforma, lignes, client, remiseGlobale }),
}));
