import { arrondirFcfa } from '../commun/prix';
import { sens, type MouvementJournal } from './journal';
import type { Caisse } from './tresorerie';

/**
 * État des caisses sur une période : pour chaque caisse, ce qu'elle avait en
 * ouverture, ce qui est entré, ce qui est sorti, et ce qui reste.
 *
 * Une maison qui tient dix ou vingt caisses ne les lit plus une par une : elle
 * veut la colonne des soldes et le total en bas. C'est l'écran que le gérant
 * imprime le soir, et celui qu'il rapproche de l'espèce comptée.
 *
 * Le solde stocké sur la caisse est celui d'aujourd'hui. On remonte donc le
 * temps : l'ouverture est le solde actuel moins tout ce qui a bougé depuis le
 * début de la période — y compris après la date de fin, quand on regarde une
 * période passée.
 */

/** Mouvement tel que l'état des caisses le lit : le sens, le montant, la caisse. */
export interface MouvementCaisse extends MouvementJournal {
  caisse_id: string | null;
}

export interface LigneEtatCaisse {
  id: string;
  code: string;
  nom: string;
  responsable: string | null;
  est_active: boolean;
  /** Solde au début de la période. */
  ouverture: number;
  recettes: number;
  depenses: number;
  /** Solde à la fin de la période : ouverture + recettes − dépenses. */
  cloture: number;
  /** Solde d'aujourd'hui, qui peut différer de la clôture sur une période passée. */
  solde_actuel: number;
  mouvements: number;
}

/**
 * Une ligne par caisse, dans l'ordre reçu.
 *
 * `finISO` borne la période ; les mouvements postérieurs servent encore à
 * calculer l'ouverture, mais ne comptent ni en recettes ni en dépenses.
 */
export function etatCaisses(
  caisses: readonly Caisse[],
  mouvementsDepuisDebut: readonly MouvementCaisse[],
  finISO: string,
): LigneEtatCaisse[] {
  return caisses.map((c) => {
    const siens = mouvementsDepuisDebut.filter((m) => m.caisse_id === c.id);
    const ouverture = arrondirFcfa(siens.reduce((s, m) => s - sens(m), c.solde_actuel));
    const periode = siens.filter((m) => m.date_operation <= finISO);
    const recettes = arrondirFcfa(periode.filter((m) => m.type === 'RECETTE').reduce((s, m) => s + m.montant, 0));
    const depenses = arrondirFcfa(periode.filter((m) => m.type === 'DEPENSE').reduce((s, m) => s + m.montant, 0));
    return {
      id: c.id,
      code: c.code,
      nom: c.nom,
      responsable: c.responsable,
      est_active: c.est_active,
      ouverture,
      recettes,
      depenses,
      cloture: arrondirFcfa(ouverture + recettes - depenses),
      solde_actuel: c.solde_actuel,
      mouvements: periode.length,
    };
  });
}

export interface RecapEtatCaisses {
  nombre: number;
  actives: number;
  ouverture: number;
  recettes: number;
  depenses: number;
  cloture: number;
  solde_actuel: number;
  /** Caisses dans le rouge aujourd'hui : à régulariser, jamais normal. */
  negatives: number;
  mouvements: number;
}

export function recapEtatCaisses(lignes: readonly LigneEtatCaisse[]): RecapEtatCaisses {
  const somme = (f: (l: LigneEtatCaisse) => number) => arrondirFcfa(lignes.reduce((s, l) => s + f(l), 0));
  return {
    nombre: lignes.length,
    actives: lignes.filter((l) => l.est_active).length,
    ouverture: somme((l) => l.ouverture),
    recettes: somme((l) => l.recettes),
    depenses: somme((l) => l.depenses),
    cloture: somme((l) => l.cloture),
    solde_actuel: somme((l) => l.solde_actuel),
    negatives: lignes.filter((l) => l.solde_actuel < 0).length,
    mouvements: lignes.reduce((s, l) => s + l.mouvements, 0),
  };
}

export type EtatCaisseRetenu = 'TOUTES' | 'ACTIVES' | 'INACTIVES' | 'MOUVEMENTEES' | 'NEGATIVES';

export const ETATS_CAISSE: Array<{ id: EtatCaisseRetenu; label: string }> = [
  { id: 'ACTIVES', label: 'Caisses actives' },
  { id: 'TOUTES', label: 'Toutes les caisses' },
  { id: 'INACTIVES', label: 'Caisses fermées' },
  { id: 'MOUVEMENTEES', label: 'Mouvementées sur la période' },
  { id: 'NEGATIVES', label: 'Soldes négatifs' },
];

export interface FiltresCaisses {
  recherche?: string;
  etat?: EtatCaisseRetenu;
}

/** Recherche sur le code et le libellé, puis état retenu. */
export function filtrerCaisses(lignes: readonly LigneEtatCaisse[], filtres: FiltresCaisses = {}): LigneEtatCaisse[] {
  const q = filtres.recherche?.trim().toLowerCase() ?? '';
  return lignes.filter((l) => {
    if (q && !`${l.code} ${l.nom} ${l.responsable ?? ''}`.toLowerCase().includes(q)) return false;
    switch (filtres.etat ?? 'ACTIVES') {
      case 'ACTIVES': return l.est_active;
      case 'INACTIVES': return !l.est_active;
      case 'MOUVEMENTEES': return l.mouvements > 0;
      case 'NEGATIVES': return l.solde_actuel < 0;
      default: return true;
    }
  });
}

/** Filtres en vigueur, en une phrase : écrite sur le document et dans l'export. */
export function perimetreCaisses(filtres: FiltresCaisses & { debut: string; fin: string }): string {
  return [
    ETATS_CAISSE.find((e) => e.id === (filtres.etat ?? 'ACTIVES'))?.label ?? '',
    `du ${filtres.debut} au ${filtres.fin}`,
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
  ].filter(Boolean).join(' · ');
}
