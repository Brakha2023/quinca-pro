import type { FormatImpression } from './facture';
import type { LignePanier } from './panier';

/**
 * La liasse : ce qui sort de l'imprimante une fois la vente encaissée.
 *
 * Au comptoir, le papier ne se tire pas au hasard. La facture part en **deux
 * exemplaires** — un pour le client, un qui reste à la maison, signé — et la
 * marchandise qui sort est accompagnée d'un **bon de livraison**, celui que le
 * magasinier garde et que le client signe à la remise. Le caissier choisit
 * donc entre deux liasses, et le ticket 80 mm reste là pour la vente rapide.
 *
 * Ce module dit quelles feuilles sortent, dans quel ordre, et ce que porte
 * chacune. L'écran n'a plus qu'à les rendre à la file : le navigateur n'a
 * aucun moyen de demander deux copies à l'imprimante, c'est donc le document
 * qui est répété, chaque exemplaire nommé pour qu'on ne les confonde pas.
 */

/** Un pour le client, un pour la maison. */
export const COPIES_FACTURE = 2;

export type SortiePapier = 'TICKET' | 'FACTURE' | 'FACTURE_BL';

export interface ChoixSortie {
  id: SortiePapier;
  libelle: string;
  aide: string;
}

/** Les choix proposés au caissier, dans l'ordre où ils s'affichent. */
export const SORTIES_PAPIER: readonly ChoixSortie[] = [
  { id: 'FACTURE_BL', libelle: 'Facture ×2 + bon de livraison', aide: 'La marchandise part avec son bon, signé à la remise.' },
  { id: 'FACTURE', libelle: 'Facture ×2', aide: 'Un exemplaire pour le client, un pour la maison.' },
  { id: 'TICKET', libelle: 'Ticket 80 mm', aide: 'La vente rapide, sur l’imprimante de caisse.' },
];

export const libelleSortie = (sortie: SortiePapier): string =>
  SORTIES_PAPIER.find((s) => s.id === sortie)?.libelle ?? sortie;

/** Une feuille de la liasse, dans l'ordre où elle sort. */
export interface Feuille {
  piece: 'FACTURE' | 'BON_LIVRAISON';
  /** À qui revient l'exemplaire ; nul quand la pièce ne sort qu'une fois. */
  exemplaire: string | null;
}

const EXEMPLAIRES = ['Exemplaire client', 'Exemplaire maison'];

/**
 * Les feuilles à envoyer à l'imprimante. Le ticket n'en fait pas partie : il
 * a sa propre mise en page, sur un autre papier et souvent une autre machine.
 */
export function feuillesAImprimer(sortie: SortiePapier): Feuille[] {
  if (sortie === 'TICKET') return [];
  const factures: Feuille[] = Array.from({ length: COPIES_FACTURE }, (_, i) => ({
    piece: 'FACTURE',
    exemplaire: EXEMPLAIRES[i] ?? `Exemplaire ${i + 1}`,
  }));
  return sortie === 'FACTURE_BL' ? [...factures, { piece: 'BON_LIVRAISON', exemplaire: null }] : factures;
}

/**
 * Ce que le poste propose d'office. Le format par défaut du poste décide du
 * papier (Paramètres → Documents) ; une livraison demandée au ticket appelle
 * son bon, puisque la marchandise ne part pas avec le client.
 */
export function sortieParDefaut(format: FormatImpression, avecLivraison: boolean): SortiePapier {
  if (format === 'TICKET') return 'TICKET';
  return avecLivraison ? 'FACTURE_BL' : 'FACTURE';
}

/** Ligne telle qu'elle s'imprime sur le bon : la marchandise, pas l'argent. */
export interface LigneBonLivraison {
  code: string;
  designation: string;
  quantite: number;
  unite: string;
  depot: string;
}

export function lignesBonLivraison(lignes: LignePanier[], depot: string): LigneBonLivraison[] {
  return lignes.map((l) => ({
    code: l.code,
    designation: l.designation,
    quantite: l.quantite,
    unite: l.unite,
    depot,
  }));
}

/** Pied du bon : de quoi vérifier le chargement sans compter les lignes. */
export function recapBonLivraison(lignes: LigneBonLivraison[]): { lignes: number; articles: number } {
  return { lignes: lignes.length, articles: lignes.reduce((total, l) => total + l.quantite, 0) };
}
