import { create } from 'zustand';
import type { Client } from '../../core/clients';
import { ajouterAuPanier, remiseCommerciale, type LignePanier } from '../../core/ventes';
import type { Article } from '../../core/articles';
import type { BrouillonVente } from './brouillons.store';

interface POSState {
  lignes: LignePanier[];
  /** Client du ticket en cours ; null = client comptoir. */
  client: Client | null;
  /** Remise accordée sur la vente entière, **en francs**. */
  remise: number;
  /**
   * La remise suit encore le taux commercial du client.
   *
   * Un client en compte a un taux négocié ; au comptoir on ne manipule que des
   * francs. Le montant se recalcule donc à chaque article ajouté — tant que le
   * caissier n'a pas écrit le sien. Dès qu'il tape une somme, elle tient : ce
   * qu'un homme a décidé devant le client ne se fait pas écraser par un calcul.
   */
  remiseAuto: boolean;
  familleId: string;
  recherche: string;
  /** Proforma en cours de facturation (n° affiché, passe FACTUREE à l'encaissement). */
  proforma: { id: string; numero: string } | null;

  setClient: (client: Client | null) => void;
  setRemise: (montant: number) => void;
  setFamilleId: (id: string) => void;
  setRecherche: (recherche: string) => void;

  ajouterArticle: (article: Article, quantite?: number, prixVip?: boolean) => void;
  modifierQuantite: (articleId: string, quantite: number) => void;
  supprimerLigne: (articleId: string) => void;
  viderPanier: () => void;
  /** Remplace le ticket par les lignes d'une proforma (client et remise compris). */
  chargerProforma: (proforma: { id: string; numero: string }, lignes: LignePanier[], client: Client | null, remise: number) => void;
  /** Reprend une vente mise de côté : le ticket en cours est remplacé. */
  reprendreBrouillon: (brouillon: BrouillonVente) => void;
}

/** État du ticket en cours (UI uniquement ; la persistance se fait à la validation). */
export const usePOSStore = create<POSState>((set, get) => ({
  lignes: [],
  client: null,
  remise: 0,
  remiseAuto: true,
  familleId: '',
  recherche: '',
  proforma: null,

  // Choisir un client en compte applique d'office sa remise commerciale,
  // convertie en francs sur le ticket du moment, et modifiable ensuite.
  setClient: (client) => set({
    client,
    remiseAuto: true,
    remise: client ? remiseCommerciale(get().lignes, client.remise_percent) : 0,
  }),

  setRemise: (montant) => set({ remise: Math.max(Math.round(montant), 0), remiseAuto: false }),

  setFamilleId: (familleId) => set({ familleId }),
  setRecherche: (recherche) => set({ recherche }),

  ajouterArticle: (article, quantite = 1, prixVip = false) =>
    set((s) => {
      const lignes = ajouterAuPanier(s.lignes, {
        article_id: article.id,
        code: article.code,
        designation: article.designation,
        unite: article.unite,
        prix_unitaire_ttc: prixVip && article.prix_vip != null ? article.prix_vip : article.prix_vente,
        tva_percent: article.tva,
        quantite,
        remise_percent: 0,
      });
      return { lignes, remise: s.remiseAuto && s.client ? remiseCommerciale(lignes, s.client.remise_percent) : s.remise };
    }),

  modifierQuantite: (articleId, quantite) => {
    if (quantite <= 0) { get().supprimerLigne(articleId); return; }
    set((s) => {
      const lignes = s.lignes.map((l) => (l.article_id === articleId ? { ...l, quantite } : l));
      return { lignes, remise: s.remiseAuto && s.client ? remiseCommerciale(lignes, s.client.remise_percent) : s.remise };
    });
  },

  supprimerLigne: (articleId) =>
    set((s) => {
      const lignes = s.lignes.filter((l) => l.article_id !== articleId);
      return { lignes, remise: s.remiseAuto && s.client ? remiseCommerciale(lignes, s.client.remise_percent) : s.remise };
    }),

  viderPanier: () => set({ lignes: [], client: null, remise: 0, remiseAuto: true, proforma: null }),

  chargerProforma: (proforma, lignes, client, remise) => set({ proforma, lignes, client, remise, remiseAuto: false }),

  reprendreBrouillon: (b) => set({
    lignes: b.lignes, client: b.client, remise: b.remise, remiseAuto: b.remiseAuto, proforma: null,
  }),
}));
