import { arrondirFcfa, arrondirMontant, margePourcent } from '../commun/prix';
import type { Article } from './article';

/** Stock d'un article dans un dépôt, tel que le rend la vue de la fiche article. */
export interface StockDepot {
  depot_id: string;
  depot_nom: string;
  quantite: number;
  quantite_reservee: number;
  quantite_disponible: number;
  cout_moyen: number;
  date_dernier_mouvement: string | null;
}

export interface TotauxStock {
  quantite: number;
  reservee: number;
  disponible: number;
  /** Valeur au coût moyen pondéré de chaque dépôt (ce que le stock a coûté). */
  valeur: number;
}

export function totauxStock(lignes: StockDepot[]): TotauxStock {
  return lignes.reduce<TotauxStock>(
    (t, l) => ({
      quantite: t.quantite + l.quantite,
      reservee: t.reservee + l.quantite_reservee,
      disponible: t.disponible + l.quantite_disponible,
      valeur: arrondirFcfa(t.valeur + l.quantite * l.cout_moyen),
    }),
    { quantite: 0, reservee: 0, disponible: 0, valeur: 0 },
  );
}

export type StatutStock = 'RUPTURE' | 'ALERTE' | 'SURSTOCK' | 'NORMAL';

export const LIBELLES_STATUT_STOCK: Record<StatutStock, string> = {
  RUPTURE: 'Rupture',
  ALERTE: 'Sous le minimum',
  SURSTOCK: 'Au-dessus du maximum',
  NORMAL: 'Normal',
};

/** Un stock_min ou stock_max à 0 signifie « non renseigné » : pas de seuil à comparer. */
export function statutStock(article: Pick<Article, 'stock_min' | 'stock_max'>, quantite: number): StatutStock {
  if (quantite <= 0) return 'RUPTURE';
  if (article.stock_min > 0 && quantite <= article.stock_min) return 'ALERTE';
  if (article.stock_max > 0 && quantite > article.stock_max) return 'SURSTOCK';
  return 'NORMAL';
}

/** Ventes d'un article sur une période, agrégées en SQL. */
export interface VentesArticle {
  quantite: number;
  total_ht: number;
  total_ttc: number;
  nombre_ventes: number;
  derniere_date: string | null;
  dernier_prix: number | null;
}

export const VENTES_VIDES: VentesArticle = {
  quantite: 0,
  total_ht: 0,
  total_ttc: 0,
  nombre_ventes: 0,
  derniere_date: null,
  dernier_prix: null,
};

export interface IndicateursArticle {
  marge_valeur: number;
  marge_percent: number;
  /** Marge au tarif VIP, nulle si l'article n'a pas de tarif VIP. */
  marge_vip_valeur: number | null;
  marge_vip_percent: number | null;
  statut_stock: StatutStock;
  valeur_achat: number;
  valeur_vente: number;
  /** Marge théorique si tout le stock partait au prix de vente. */
  marge_potentielle: number;
  /** Quantité vendue par jour sur la période observée. */
  vente_par_jour: number;
  /** Jours de stock restants au rythme de la période ; null sans vente sur la période. */
  couverture_jours: number | null;
  /** Chiffre d'affaires HT de la période rapporté à la valeur du stock. */
  rotation: number | null;
}

/**
 * Indicateurs de la fiche article : marges au tarif courant, valorisation du
 * stock et rythme d'écoulement sur la période observée.
 */
export function indicateursArticle(
  article: Pick<Article, 'prix_achat' | 'prix_vente' | 'prix_vip' | 'stock_min' | 'stock_max'>,
  totaux: TotauxStock,
  ventes: VentesArticle,
  joursPeriode: number,
): IndicateursArticle {
  // Le rythme affiché est arrondi, la couverture se calcule sur le rythme exact
  // (sinon l'arrondi au centième déplace la projection de plusieurs jours).
  const rythme = joursPeriode > 0 ? ventes.quantite / joursPeriode : 0;
  const valeurAchat = arrondirFcfa(totaux.quantite * article.prix_achat);
  const valeurVente = arrondirFcfa(totaux.quantite * article.prix_vente);

  return {
    marge_valeur: arrondirMontant(article.prix_vente - article.prix_achat),
    marge_percent: margePourcent(article.prix_achat, article.prix_vente),
    marge_vip_valeur: article.prix_vip == null ? null : arrondirMontant(article.prix_vip - article.prix_achat),
    marge_vip_percent: article.prix_vip == null ? null : margePourcent(article.prix_achat, article.prix_vip),
    statut_stock: statutStock(article, totaux.quantite),
    valeur_achat: valeurAchat,
    valeur_vente: valeurVente,
    marge_potentielle: arrondirFcfa(valeurVente - valeurAchat),
    vente_par_jour: arrondirMontant(rythme),
    couverture_jours: rythme > 0 ? Math.round(totaux.quantite / rythme) : null,
    rotation: totaux.valeur > 0 ? arrondirMontant(ventes.total_ht / totaux.valeur) : null,
  };
}

/** Périodes proposées sur la fiche article. */
export const PERIODES_FICHE = [
  { id: '30', label: '30 derniers jours', jours: 30 },
  { id: '90', label: '3 derniers mois', jours: 90 },
  { id: '365', label: '12 derniers mois', jours: 365 },
] as const;

export type PeriodeFiche = (typeof PERIODES_FICHE)[number]['id'];

/** Début de période au format ISO, borne incluse, à partir d'une date de référence. */
export function debutPeriode(jours: number, reference: Date = new Date()): string {
  const debut = new Date(reference);
  debut.setDate(debut.getDate() - jours);
  return debut.toISOString();
}
