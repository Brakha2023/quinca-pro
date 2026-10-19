import type { TypeMouvementStock } from '@quinca/shared-types';
import { arrondirFcfa, arrondirMontant } from '../commun/prix';

/**
 * Historiques : les pièces déjà enregistrées, réunies sous un même menu.
 *
 * Chaque section répond à la même question — « qu'avons-nous passé, et quand ? »
 * — et donne la même chose : une liste de **pièces** (pas de lignes), filtrable
 * par période, imprimable en A4 et exportable en Excel, d'où l'on rouvre la
 * pièce pour la rééditer.
 *
 * Rien n'est recalculé ici : ce module décrit les sections et totalise ce que
 * les écrans affichent. Les règles métier restent dans `core/ventes`,
 * `core/stock`, `core/fournisseurs`.
 */

export type SectionHistorique =
  | 'ventes'
  | 'commandes-fournisseurs'
  | 'entrees'
  | 'transferts'
  | 'productions'
  | 'destockages'
  | 'inventaires';

export interface DescriptionSection {
  id: SectionHistorique;
  label: string;
  /** Ce qu'une ligne de la liste représente. */
  piece: string;
  /** En-tête de la colonne « tiers » : elle ne nomme pas la même chose partout. */
  tiers: string;
  /** En-tête de la colonne monétaire, qui ne mesure pas la même chose partout. */
  montant: string;
}

export const SECTIONS_HISTORIQUE: DescriptionSection[] = [
  { id: 'ventes', label: 'Ventes', piece: 'vente', tiers: 'Client', montant: 'Total TTC' },
  { id: 'commandes-fournisseurs', label: 'Commandes fournisseurs', piece: 'commande', tiers: 'Fournisseur', montant: 'Total TTC' },
  { id: 'entrees', label: 'Entrées en stock (achat)', piece: 'bon d’entrée', tiers: 'Fournisseur', montant: 'Valeur entrée' },
  { id: 'transferts', label: 'Transferts inter-dépôt', piece: 'bon de transfert', tiers: 'Dépôt de départ', montant: 'Valeur transférée' },
  { id: 'productions', label: 'Productions', piece: 'production', tiers: 'Produits', montant: 'Coût des matières' },
  { id: 'destockages', label: 'Déstockages et casses', piece: 'bon de sortie', tiers: 'Motif', montant: 'Valeur sortie' },
  { id: 'inventaires', label: 'Inventaires', piece: 'fiche d’inventaire', tiers: 'Motif', montant: 'Écart valorisé' },
];

export const estSectionHistorique = (v: string | undefined): v is SectionHistorique =>
  SECTIONS_HISTORIQUE.some((s) => s.id === v);

export const descriptionSection = (id: SectionHistorique): DescriptionSection =>
  SECTIONS_HISTORIQUE.find((s) => s.id === id) ?? SECTIONS_HISTORIQUE[0]!;

/**
 * Sections bâties sur le journal des mouvements : la pièce y est la
 * **référence** commune à ses lignes. Un transfert ne retient que sa sortie :
 * son entrée porte la même référence et doublerait le bon.
 */
export const TYPES_MOUVEMENT_SECTION: Partial<Record<SectionHistorique, TypeMouvementStock[]>> = {
  entrees: ['ENTREE_ACHAT', 'RETOUR_CLIENT'],
  transferts: ['TRANSFERT_SORTIE'],
  destockages: ['SORTIE_DESTOCKAGE', 'CASSE'],
  inventaires: ['INVENTAIRE'],
};

/** Une pièce, quelle que soit la section : c'est ce que la liste affiche. */
export interface PieceHistorique {
  id: string;
  reference: string;
  date: string;
  /** Client, fournisseur, dépôt ou motif selon la section (voir `DescriptionSection`). */
  tiers: string | null;
  depot: string | null;
  lignes: number;
  quantite: number;
  montant: number;
  statut: string | null;
  utilisateur: string | null;
}

export interface RecapHistorique {
  pieces: number;
  lignes: number;
  quantite: number;
  montant: number;
}

export function recapHistorique(pieces: readonly PieceHistorique[]): RecapHistorique {
  return {
    pieces: pieces.length,
    lignes: pieces.reduce((s, p) => s + p.lignes, 0),
    quantite: arrondirMontant(pieces.reduce((s, p) => s + p.quantite, 0)),
    montant: arrondirFcfa(pieces.reduce((s, p) => s + p.montant, 0)),
  };
}

export interface FiltresHistorique {
  debut: string;
  fin: string;
  depotNom?: string | null;
  recherche?: string;
}

/** Les filtres seuls, en une phrase : l'écran affiche déjà le nom de la section. */
export function filtresEnClair(filtres: FiltresHistorique): string {
  return [
    `du ${filtres.debut} au ${filtres.fin}`,
    filtres.depotNom ? `dépôt « ${filtres.depotNom} »` : null,
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
  ].filter(Boolean).join(' · ');
}

/** Périmètre complet, section comprise : écrit sur le document et dans l'export. */
export function perimetreHistorique(section: SectionHistorique, filtres: FiltresHistorique): string {
  return `${descriptionSection(section).label} · ${filtresEnClair(filtres)}`;
}
