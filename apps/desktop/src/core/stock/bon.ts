import type { TypeMouvementStock } from '@quinca/shared-types';
import { arrondirFcfa } from '../commun/prix';
import { LIBELLES_MOUVEMENT, SENS_MOUVEMENT } from './mouvement';

/** Mouvement tel qu'il est relu pour rééditer son bon. */
export interface MouvementDuBon {
  id: string;
  type: TypeMouvementStock;
  article_code: string;
  article_designation: string;
  article_unite: string;
  depot_nom: string;
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  cout_unitaire: number | null;
  /** Remise accordée sur la ligne, en % ; `cout_unitaire` en est déjà net. (Bons d'avant la remise globale.) */
  remise_percent: number;
  /** Part de la remise du bon portée par la ligne, en francs ; `cout_unitaire` en est déjà net. */
  remise_montant: number;
  /** Arrivée réelle de la marchandise, quand elle a été saisie. */
  date_livraison: string | null;
  motif: string | null;
  fournisseur_nom: string | null;
  utilisateur: string;
  created_at: string;
}

export interface LigneBonImprime {
  code: string;
  designation: string;
  unite: string;
  /** Quantité du bon, signée : négative pour une sortie. */
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  cout_unitaire: number | null;
  remise_percent: number;
  remise_montant: number;
  /** Quantité × coût unitaire net ; null quand le coût n'est pas renseigné (sorties). */
  valeur: number | null;
}

export interface BonStock {
  reference: string;
  titre: string;
  date: string;
  /** Dépôt concerné ; pour un transfert, le dépôt d'origine. */
  depot: string;
  /** Dépôt d'arrivée d'un transfert. */
  depot_destination: string | null;
  fournisseur: string | null;
  /** Arrivée réelle de la marchandise ; null quand elle n'a pas été saisie. */
  date_livraison: string | null;
  motif: string | null;
  utilisateur: string;
  lignes: LigneBonImprime[];
  /** Somme des valeurs connues, **nette** de remise ; 0 si aucune ligne n'est valorisée. */
  total_valeur: number;
  /** Remise accordée sur le bon entier, en francs ; 0 s'il n'y en a pas. */
  remise_globale: number;
  /** Au moins une ligne porte un coût : la colonne valeur a un sens. */
  valorise: boolean;
  /** Au moins une remise a été accordée : la colonne n'est affichée que dans ce cas. */
  avec_remise: boolean;
}

const TITRES: Partial<Record<TypeMouvementStock, string>> = {
  ENTREE_ACHAT: "Bon d'entrée — achat",
  RETOUR_CLIENT: "Bon d'entrée — retour client",
  SORTIE_DESTOCKAGE: 'Bon de sortie — déstockage',
  CASSE: 'Bon de sortie — casse / perte',
  TRANSFERT_SORTIE: 'Bon de transfert entre dépôts',
  TRANSFERT_ENTREE: 'Bon de transfert entre dépôts',
  INVENTAIRE: "Fiche d'inventaire",
  SORTIE_PRODUCTION: 'Bon de production',
  ENTREE_PRODUCTION: 'Bon de production',
  AJUSTEMENT: 'Bon d’ajustement',
};

export const titreBon = (type: TypeMouvementStock): string => TITRES[type] ?? `Bon — ${LIBELLES_MOUVEMENT[type]}`;

/**
 * Reconstruit un bon imprimable à partir des mouvements qui portent la même
 * référence. Un transfert en produit deux par article (sortie puis entrée) :
 * la ligne n'est comptée qu'une fois, les deux dépôts figurant en tête.
 */
export function construireBon(reference: string, mouvements: MouvementDuBon[]): BonStock | null {
  if (mouvements.length === 0) return null;
  const ordonnes = [...mouvements].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const premier = ordonnes[0]!;
  const estTransfert = ordonnes.some((m) => m.type === 'TRANSFERT_SORTIE');
  const retenus = estTransfert ? ordonnes.filter((m) => m.type === 'TRANSFERT_SORTIE') : ordonnes;

  const lignes = retenus.map<LigneBonImprime>((m) => ({
    code: m.article_code,
    designation: m.article_designation,
    unite: m.article_unite,
    quantite: SENS_MOUVEMENT[m.type] < 0 ? -Math.abs(m.quantite) : m.quantite,
    quantite_avant: m.quantite_avant,
    quantite_apres: m.quantite_apres,
    cout_unitaire: m.cout_unitaire,
    remise_percent: m.remise_percent,
    remise_montant: m.remise_montant,
    valeur: m.cout_unitaire == null ? null : arrondirFcfa(Math.abs(m.quantite) * m.cout_unitaire),
  }));

  return {
    reference,
    titre: titreBon(premier.type),
    date: premier.created_at,
    depot: premier.depot_nom,
    depot_destination: estTransfert ? (ordonnes.find((m) => m.type === 'TRANSFERT_ENTREE')?.depot_nom ?? null) : null,
    fournisseur: ordonnes.find((m) => m.fournisseur_nom)?.fournisseur_nom ?? null,
    date_livraison: ordonnes.find((m) => m.date_livraison)?.date_livraison ?? null,
    motif: ordonnes.find((m) => m.motif)?.motif ?? null,
    utilisateur: premier.utilisateur,
    lignes,
    total_valeur: arrondirFcfa(lignes.reduce((s, l) => s + (l.valeur ?? 0), 0)),
    remise_globale: arrondirFcfa(lignes.reduce((s, l) => s + l.remise_montant, 0)),
    valorise: lignes.some((l) => l.valeur != null),
    avec_remise: lignes.some((l) => l.remise_percent > 0 || l.remise_montant > 0),
  };
}
