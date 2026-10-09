import { arrondirFcfa } from '../commun/prix';
import type { TypeMouvementTresorerie } from '@quinca/shared-types';

/** Mouvement tel que le journal de caisse le lit (sens et montant suffisent au solde). */
export interface MouvementJournal {
  date_operation: string;
  type: TypeMouvementTresorerie;
  montant: number;
}

/** Signé : une recette entre, une dépense sort. */
export const sens = (m: MouvementJournal): number => (m.type === 'RECETTE' ? m.montant : -m.montant);

/**
 * Solde de la caisse au début de la période.
 *
 * Le solde stocké sur la caisse est celui d'aujourd'hui : on remonte le temps
 * en retirant tous les mouvements survenus depuis le début de la période.
 */
export function soldeOuverture(soldeActuel: number, mouvementsDepuisDebut: readonly MouvementJournal[]): number {
  return arrondirFcfa(mouvementsDepuisDebut.reduce((s, m) => s - sens(m), soldeActuel));
}

export interface LigneJournal {
  id: string;
  date: string;
  piece: string;
  categorie: string;
  description: string;
  recette: number;
  depense: number;
  /** Solde de la caisse après l'opération. */
  solde: number;
}

export interface JournalCaisse {
  ouverture: number;
  lignes: LigneJournal[];
  totalRecettes: number;
  totalDepenses: number;
  /** Solde après le dernier mouvement de la période. */
  cloture: number;
}

/** Mouvement tel que le journal l'affiche. */
export interface MouvementAffiche extends MouvementJournal {
  id: string;
  categorie: string;
  description: string | null;
  reference: string | null;
}

/**
 * Journal de caisse d'une période : les mouvements du plus ancien au plus
 * récent, avec le solde courant après chacun. Le solde de clôture se déduit de
 * l'ouverture et des totaux, jamais d'un cumul de lignes arrondies.
 */
export function construireJournalCaisse(ouverture: number, mouvements: readonly MouvementAffiche[]): JournalCaisse {
  const ordonnes = [...mouvements].sort((a, b) => a.date_operation.localeCompare(b.date_operation));
  let solde = ouverture;
  let totalRecettes = 0;
  let totalDepenses = 0;
  const lignes = ordonnes.map((m) => {
    solde = arrondirFcfa(solde + sens(m));
    if (m.type === 'RECETTE') totalRecettes += m.montant;
    else totalDepenses += m.montant;
    return {
      id: m.id,
      date: m.date_operation,
      piece: m.reference ?? '',
      categorie: m.categorie,
      description: m.description ?? '',
      recette: m.type === 'RECETTE' ? m.montant : 0,
      depense: m.type === 'DEPENSE' ? m.montant : 0,
      solde,
    };
  });
  totalRecettes = arrondirFcfa(totalRecettes);
  totalDepenses = arrondirFcfa(totalDepenses);
  return { ouverture, lignes, totalRecettes, totalDepenses, cloture: arrondirFcfa(ouverture + totalRecettes - totalDepenses) };
}
