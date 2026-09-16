import { create } from 'zustand';
import { Article } from '../../core/entities/article.entity';
import { LigneVente, ModePaiement } from '../../core/entities/vente.entity';
import { v4 as uuidv4 } from 'uuid';

interface POSState {
  lignes: LigneVente[];
  familleActive: string;
  recherche: string;
  remiseGlobale: number;
  dateVente: string;
  
  setFamilleActive: (famille: string) => void;
  setRecherche: (recherche: string) => void;
  setRemiseGlobale: (remise: number) => void;
  
  ajouterArticle: (article: Article, quantite?: number) => void;
  modifierQuantite: (ligneId: string, quantite: number) => void;
  supprimerLigne: (ligneId: string) => void;
  viderPanier: () => void;
  
  calculerSousTotal: () => number;
  calculerTVA: () => number;
  calculerTotal: () => number;
  calculerNombreArticles: () => number;
}

export const usePOSStore = create<POSState>((set, get) => ({
  lignes: [],
  familleActive: 'Tous',
  recherche: '',
  remiseGlobale: 0,
  dateVente: new Date().toISOString(),

  setFamilleActive: (famille) => set({ familleActive: famille }),
  setRecherche: (recherche) => set({ recherche }),
  setRemiseGlobale: (remise) => set({ remiseGlobale: remise }),

  ajouterArticle: (article, quantite = 1) => {
    const state = get();
    const ligneExistante = state.lignes.find(l => l.article_id === article.id);

    if (ligneExistante) {
      set({
        lignes: state.lignes.map(l =>
          l.article_id === article.id
            ? { ...l, quantite: l.quantite + quantite }
            : l
        ),
      });
    } else {
      const prixUnitaire = article.prix_vente_ttc;
      const totalTTC = prixUnitaire * quantite;
      const totalHT = totalTTC / (1 + article.tva / 100);

      const nouvelleLigne: LigneVente = {
        id: uuidv4(),
        article_id: article.id,
        designation: article.designation,
        prix_unitaire: prixUnitaire,
        quantite,
        remise_pct: 0,
        total_ht: totalHT,
        total_ttc: totalTTC,
      };

      set({ lignes: [...state.lignes, nouvelleLigne] });
    }
  },

  modifierQuantite: (ligneId, quantite) => {
    if (quantite <= 0) {
      get().supprimerLigne(ligneId);
      return;
    }
    set({
      lignes: get().lignes.map(l => {
        if (l.id === ligneId) {
          const totalTTC = l.prix_unitaire * quantite;
          const totalHT = totalTTC / 1.18;
          return { ...l, quantite, total_ht: totalHT, total_ttc: totalTTC };
        }
        return l;
      }),
    });
  },

  supprimerLigne: (ligneId) => {
    set({ lignes: get().lignes.filter(l => l.id !== ligneId) });
  },

  viderPanier: () => set({ lignes: [], remiseGlobale: 0, dateVente: new Date().toISOString() }),

  calculerSousTotal: () => {
    return get().lignes.reduce((sum, l) => sum + l.total_ht, 0);
  },

  calculerTVA: () => {
    return get().calculerTotal() - get().calculerSousTotal();
  },

  calculerTotal: () => {
    const total = get().lignes.reduce((sum, l) => sum + l.total_ttc, 0);
    const remise = get().remiseGlobale;
    return total - (total * remise / 100);
  },

  calculerNombreArticles: () => {
    return get().lignes.reduce((sum, l) => sum + l.quantite, 0);
  },
}));
