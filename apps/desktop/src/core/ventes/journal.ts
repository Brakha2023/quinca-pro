import type { ModePaiement, StatutVente } from '@quinca/shared-types';
import { arrondirFcfa } from '../commun/prix';

/**
 * Journal des ventes : ce qu'on lit en haut de l'écran, et ce qu'on imprime au
 * bas de la journée de caisse. Une vente annulée ne compte dans rien — ni
 * chiffre d'affaires, ni encaissement, ni créance.
 */
export interface LigneJournalVente {
  total_ttc: number | null;
  montant_percu: number | null;
  monnaie: number | null;
  reste_a_payer: number | null;
  statut: string | null;
  mode_paiement: string | null;
}

export interface RecapJournalVentes {
  nombre: number;
  annulees: number;
  en_attente: number;
  chiffre_affaires: number;
  /** Ce qui est resté en caisse : le rendu de monnaie n'en fait pas partie. */
  encaisse: number;
  credit: number;
  /** Encaissement ventilé par mode de paiement, dans l'ordre d'apparition. */
  par_mode: Array<{ mode: ModePaiement | string; montant: number }>;
}

const encaissementDe = (v: LigneJournalVente) => (v.montant_percu ?? 0) - (v.monnaie ?? 0);

export function recapJournalVentes(ventes: readonly LigneJournalVente[]): RecapJournalVentes {
  const actives = ventes.filter((v) => v.statut !== 'ANNULEE');
  const parMode = new Map<string, number>();
  for (const v of actives) {
    const mode = v.mode_paiement ?? 'ESPECES';
    parMode.set(mode, (parMode.get(mode) ?? 0) + encaissementDe(v));
  }
  return {
    nombre: actives.length,
    annulees: ventes.length - actives.length,
    en_attente: actives.filter((v) => (v.statut as StatutVente) === 'EN_ATTENTE').length,
    chiffre_affaires: arrondirFcfa(actives.reduce((s, v) => s + (v.total_ttc ?? 0), 0)),
    encaisse: arrondirFcfa(actives.reduce((s, v) => s + encaissementDe(v), 0)),
    credit: arrondirFcfa(actives.reduce((s, v) => s + (v.reste_a_payer ?? 0), 0)),
    par_mode: [...parMode].map(([mode, montant]) => ({ mode, montant: arrondirFcfa(montant) })),
  };
}

/** Filtres en vigueur, en une phrase : une liste filtrée imprimée se confond sinon avec le journal entier. */
export function perimetreJournalVentes(filtres: {
  dateDebut: string;
  dateFin: string;
  caisseNom?: string | null;
  statutLabel?: string | null;
  recherche?: string;
}): string {
  const jour = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '—');
  const periode = filtres.dateDebut === filtres.dateFin ? `journée du ${jour(filtres.dateDebut)}` : `du ${jour(filtres.dateDebut)} au ${jour(filtres.dateFin)}`;
  return [
    periode,
    filtres.caisseNom ? `caisse « ${filtres.caisseNom} »` : 'toutes caisses',
    filtres.statutLabel ? `statut « ${filtres.statutLabel} »` : null,
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
  ].filter(Boolean).join(' · ');
}
