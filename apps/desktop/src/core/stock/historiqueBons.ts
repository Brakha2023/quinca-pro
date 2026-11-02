import type { TypeMouvementStock } from '@quinca/shared-types';
import { arrondirFcfa } from '../commun/prix';
import { LIBELLES_MOUVEMENT } from './mouvement';

/**
 * L'historique d'un onglet de saisie : les bons déjà enregistrés par cet
 * onglet-là, et eux seuls.
 *
 * Un bon n'est pas une ligne de `mouvements_stock` : c'est l'ensemble des
 * mouvements qui portent la même référence. Le regroupement est fait par la
 * base (voir `bonsStockQuery`) pour que le nombre de lignes d'un bon ne soit
 * jamais tronqué par une limite ; ce module ne fait que donner un sens aux
 * colonnes qui en reviennent.
 *
 * Chaque famille ci-dessous correspond à un onglet du menu Stock. Une vente
 * (`SORTIE_VENTE`) ou une production n'y figure pas : elles ont leur propre
 * écran, et un magasinier qui cherche son bon d'entrée ne veut pas lire la
 * journée de la caisse.
 */
export const TYPES_BON_ENTREE: readonly TypeMouvementStock[] = ['ENTREE_ACHAT', 'RETOUR_CLIENT'];
export const TYPES_BON_SORTIE: readonly TypeMouvementStock[] = ['SORTIE_DESTOCKAGE', 'CASSE'];
export const TYPES_BON_TRANSFERT: readonly TypeMouvementStock[] = ['TRANSFERT_SORTIE', 'TRANSFERT_ENTREE'];
export const TYPES_BON_INVENTAIRE: readonly TypeMouvementStock[] = ['INVENTAIRE'];

/** Ligne agrégée telle que la requête groupée la rend. */
export interface BonStockRow {
  reference: string | null;
  date: string | null;
  type: string | null;
  depot_nom: string | null;
  depot_destination_nom: string | null;
  fournisseur_nom: string | null;
  /** Arrivée réelle de la marchandise ; nulle sur les bons qui ne la saisissent pas. */
  date_livraison: string | null;
  /** Remise accordée sur le bon entier, en francs. */
  remise: number | null;
  motif: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
  nombre_lignes: number | null;
  /** Somme signée des quantités : total déplacé, ou écart net pour un inventaire. */
  quantite: number | null;
  valeur: number | null;
  /** Nombre de lignes portant un coût : en dessous de 1, la valeur ne veut rien dire. */
  lignes_valorisees: number | null;
  articles: string | null;
}

export interface ResumeBon {
  reference: string;
  date: string;
  type: TypeMouvementStock;
  /** « Entrée achat », « Casse / perte »… : ce que le bon a fait. */
  libelle: string;
  depot: string | null;
  /** Dépôt d'arrivée d'un transfert ; `null` partout ailleurs. */
  depot_destination: string | null;
  fournisseur: string | null;
  /** `null` quand la livraison n'a pas été datée : c'est `date` qui fait foi. */
  date_livraison: string | null;
  /** Remise accordée sur le bon, en francs ; 0 s'il n'y en a pas. */
  remise: number;
  motif: string | null;
  utilisateur: string | null;
  nombre_lignes: number;
  quantite: number;
  /** `null` quand aucune ligne n'est valorisée — un zéro affiché serait un mensonge. */
  valeur: number | null;
  /** Les articles du bon, pour un aperçu en une ligne. */
  articles: string;
}

/** Une ligne de l'agrégat devient le résumé d'un bon. */
export function resumeBon(row: BonStockRow): ResumeBon {
  const valorisees = row.lignes_valorisees ?? 0;
  return {
    reference: row.reference ?? '',
    date: row.date ?? '',
    type: (row.type ?? 'AJUSTEMENT') as TypeMouvementStock,
    libelle: LIBELLES_MOUVEMENT[(row.type ?? 'AJUSTEMENT') as TypeMouvementStock] ?? 'Mouvement',
    depot: row.depot_nom,
    depot_destination: row.depot_destination_nom,
    fournisseur: row.fournisseur_nom,
    date_livraison: row.date_livraison || null,
    remise: arrondirFcfa(row.remise ?? 0),
    motif: row.motif,
    utilisateur: [row.utilisateur_prenom, row.utilisateur_nom].filter(Boolean).join(' ') || null,
    nombre_lignes: row.nombre_lignes ?? 0,
    quantite: row.quantite ?? 0,
    valeur: valorisees > 0 ? arrondirFcfa(row.valeur ?? 0) : null,
    articles: row.articles ?? '',
  };
}

/** Ce que le bandeau annonce au-dessus de la liste. */
export function recapBons(bons: ResumeBon[]): { nombre: number; lignes: number; valeur: number; remise: number } {
  return {
    nombre: bons.length,
    lignes: bons.reduce((s, b) => s + b.nombre_lignes, 0),
    valeur: arrondirFcfa(bons.reduce((s, b) => s + (b.valeur ?? 0), 0)),
    remise: arrondirFcfa(bons.reduce((s, b) => s + b.remise, 0)),
  };
}
