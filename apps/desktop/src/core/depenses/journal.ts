import type { StatutDepense } from '@quinca/shared-types';
import { arrondirFcfa } from '../commun/prix';

/**
 * Journal des dépenses : ce qu'on lit en haut de l'écran, et ce qu'on imprime.
 * Une dépense refusée ne compte dans rien — elle n'a rien coûté.
 */
export interface LigneJournalDepense {
  montant: number | null;
  statut: string | null;
  categorie: string | null;
}

export interface RecapJournalDepenses {
  nombre: number;
  refusees: number;
  en_attente: number;
  /** Ce qui est réellement sorti de la caisse : les dépenses validées. */
  sorti: number;
  /** Ce qui est engagé et attend une décision — donc encore en caisse. */
  a_approuver: number;
  /** Dépenses validées ventilées par catégorie, la plus grosse en tête. */
  par_categorie: Array<{ categorie: string; montant: number }>;
}

export function recapJournalDepenses(depenses: readonly LigneJournalDepense[]): RecapJournalDepenses {
  const retenues = depenses.filter((d) => d.statut !== 'REFUSEE');
  const validees = retenues.filter((d) => (d.statut as StatutDepense) === 'VALIDEE');
  const attente = retenues.filter((d) => (d.statut as StatutDepense) === 'EN_ATTENTE');

  const parCategorie = new Map<string, number>();
  for (const d of validees) {
    const c = d.categorie ?? 'AUTRE_DEPENSE';
    parCategorie.set(c, (parCategorie.get(c) ?? 0) + (d.montant ?? 0));
  }

  return {
    nombre: retenues.length,
    refusees: depenses.length - retenues.length,
    en_attente: attente.length,
    sorti: arrondirFcfa(validees.reduce((s, d) => s + (d.montant ?? 0), 0)),
    a_approuver: arrondirFcfa(attente.reduce((s, d) => s + (d.montant ?? 0), 0)),
    par_categorie: [...parCategorie]
      .map(([categorie, montant]) => ({ categorie, montant: arrondirFcfa(montant) }))
      .sort((a, b) => b.montant - a.montant),
  };
}
