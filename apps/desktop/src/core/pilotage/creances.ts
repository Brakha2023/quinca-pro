import { arrondirFcfa } from '../commun/prix';

/**
 * Les impayés par ancienneté.
 *
 * Une créance de huit jours et une créance de huit mois portent le même
 * montant et n'ont pas la même valeur : la seconde est à moitié perdue. Le
 * total des créances ne le dit pas ; ce découpage, oui.
 *
 * Il se calcule sur les **factures** (ventes dont il reste à payer), pas sur le
 * solde des clients : seule la facture porte une date. Le total peut donc
 * différer du solde des comptes, qui comprend aussi les reports d'ouverture —
 * l'écart est affiché plutôt que masqué.
 */

export const TRANCHES = [
  { id: '0-30', label: '0 à 30 j', min: 0, max: 30 },
  { id: '31-60', label: '31 à 60 j', min: 31, max: 60 },
  { id: '61-90', label: '61 à 90 j', min: 61, max: 90 },
  { id: '90+', label: 'plus de 90 j', min: 91, max: Number.POSITIVE_INFINITY },
] as const;

export type TrancheAnciennete = (typeof TRANCHES)[number]['id'];

export interface FactureImpayee {
  id: string;
  numero: string;
  client: string | null;
  date: string;
  reste: number;
}

export function joursDepuis(date: string, maintenant: Date = new Date()): number {
  const jours = Math.floor((maintenant.getTime() - new Date(date).getTime()) / 86_400_000);
  // Une facture du jour a zéro jour d'âge ; une date future n'en a pas davantage.
  return Math.max(jours, 0);
}

export function trancheDe(date: string, maintenant: Date = new Date()): TrancheAnciennete {
  const jours = joursDepuis(date, maintenant);
  return (TRANCHES.find((t) => jours >= t.min && jours <= t.max) ?? TRANCHES[3]).id;
}

export interface PartAnciennete {
  tranche: TrancheAnciennete;
  label: string;
  montant: number;
  factures: number;
  part: number;
}

export interface RepartitionAnciennete {
  parts: PartAnciennete[];
  total: number;
  factures: number;
  /** Au-delà de 90 jours : ce qui ne rentrera pas tout seul. */
  au_dela_de_90: number;
}

export function repartirParAnciennete(
  factures: FactureImpayee[],
  maintenant: Date = new Date(),
): RepartitionAnciennete {
  const seaux = new Map<TrancheAnciennete, { montant: number; factures: number }>(
    TRANCHES.map((t) => [t.id, { montant: 0, factures: 0 }]),
  );
  for (const f of factures) {
    if (f.reste <= 0) continue;
    const seau = seaux.get(trancheDe(f.date, maintenant))!;
    seau.montant += f.reste;
    seau.factures += 1;
  }

  const total = arrondirFcfa([...seaux.values()].reduce((t, s) => t + s.montant, 0));
  return {
    parts: TRANCHES.map((t) => {
      const s = seaux.get(t.id)!;
      return {
        tranche: t.id,
        label: t.label,
        montant: arrondirFcfa(s.montant),
        factures: s.factures,
        part: total > 0 ? Math.round((s.montant / total) * 1000) / 10 : 0,
      };
    }),
    total,
    factures: [...seaux.values()].reduce((t, s) => t + s.factures, 0),
    au_dela_de_90: arrondirFcfa(seaux.get('90+')!.montant),
  };
}
