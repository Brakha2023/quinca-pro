import { arrondirFcfa } from '../commun/prix';
import { libelleCase } from './periodes';

/**
 * L'activité d'un compte, mois par mois : ce qu'on lui a facturé, et ce qui a
 * été réglé.
 *
 * C'est la question qu'on se pose devant un gros solde — « il me doit deux
 * millions, mais depuis quand, et est-ce qu'il paie ? ». Un chiffre unique n'y
 * répond pas : un client qui doit beaucoup parce qu'il achète beaucoup et
 * règle chaque mois n'est pas le même dossier qu'un client qui doit autant et
 * n'a rien versé depuis six mois. Il faut voir les deux courbes côte à côte.
 *
 * ### Deux séries côte à côte, jamais empilées
 *
 * L'histogramme du chiffre d'affaires empile le coût et la marge parce que
 * leur somme **est** le chiffre d'affaires. Ici, facturé et réglé partagent
 * l'unité et l'axe, mais leur somme ne veut rien dire : les empiler
 * inventerait un total. Deux barres jumelles par mois, et c'est l'**écart**
 * entre elles qui se lit — c'est lui qui creuse ou résorbe le solde.
 *
 * Le solde du compte, lui, n'est pas recalculé ici : il vient du serveur
 * (`solde_actuel`) et comprend le report d'ouverture, que ces mois ignorent.
 */

/** Ce que la base rend pour un mois : les deux sommes, déjà groupées. */
export interface PointActiviteBrut {
  /** `AAAA-MM`. */
  cle: string;
  facture: number;
  regle: number;
}

export interface PointActivite {
  cle: string;
  libelle: string;
  facture: number;
  regle: number;
  /** Facturé moins réglé : positif, le compte s'est creusé ce mois-là. */
  ecart: number;
}

export interface SerieActiviteTiers {
  points: PointActivite[];
  /** La plus haute des deux séries : l'échelle de l'axe. Jamais nulle. */
  maximum: number;
  total_facture: number;
  total_regle: number;
  /** Ce que la période a ajouté au solde (ou retiré, s'il est négatif). */
  variation: number;
  /** Aucun mouvement sur toute la période : le compte dort. */
  vide: boolean;
  /** Dernier mois où quelque chose a été réglé ; nul si rien sur la période. */
  dernier_reglement: string | null;
}

/**
 * Les `nombre` derniers mois jusqu'à `finISO` incluse, du plus ancien au plus
 * récent, en clés `AAAA-MM`.
 *
 * Le calcul passe par UTC : construire les mois en heure locale ferait sauter
 * un mois entier au premier du mois avant 1 h du matin à Abidjan.
 */
export function moisGlissants(finISO: string, nombre = 12): string[] {
  const [annee, mois] = finISO.slice(0, 7).split('-').map(Number);
  const cases: string[] = [];
  for (let i = nombre - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(annee!, mois! - 1 - i, 1));
    cases.push(d.toISOString().slice(0, 7));
  }
  return cases;
}

/** Le premier jour du plus ancien mois, pour borner la requête. */
export const debutDesMois = (mois: readonly string[]): string => `${mois[0] ?? '1970-01'}-01`;

export function serieActiviteTiers(bruts: readonly PointActiviteBrut[], mois: readonly string[]): SerieActiviteTiers {
  const parCle = new Map(bruts.map((b) => [b.cle, b]));

  // Les mois sans mouvement comptent : un trou de six mois dans les règlements
  // est précisément ce qu'on cherche à voir. On part donc des mois attendus,
  // pas des lignes rendues par la base.
  const points: PointActivite[] = mois.map((cle) => {
    const b = parCle.get(cle);
    const facture = arrondirFcfa(b?.facture ?? 0);
    const regle = arrondirFcfa(b?.regle ?? 0);
    return { cle, libelle: libelleCase(cle, 'MOIS'), facture, regle, ecart: arrondirFcfa(facture - regle) };
  });

  const total_facture = arrondirFcfa(points.reduce((t, p) => t + p.facture, 0));
  const total_regle = arrondirFcfa(points.reduce((t, p) => t + p.regle, 0));

  return {
    points,
    maximum: Math.max(...points.map((p) => Math.max(p.facture, p.regle)), 1),
    total_facture,
    total_regle,
    variation: arrondirFcfa(total_facture - total_regle),
    vide: points.every((p) => p.facture === 0 && p.regle === 0),
    dernier_reglement: points.filter((p) => p.regle > 0).at(-1)?.cle ?? null,
  };
}

/**
 * Depuis combien de mois ce compte n'a rien réglé, en se plaçant au dernier
 * mois de la série. `null` quand il a réglé ce mois-ci, ou quand la période
 * entière est muette — on ne sait alors rien, et on ne l'invente pas.
 */
export function moisSansReglement(serie: SerieActiviteTiers): number | null {
  if (serie.dernier_reglement === null) return null;
  const dernier = serie.points.at(-1)?.cle;
  if (!dernier) return null;
  const [a1, m1] = serie.dernier_reglement.split('-').map(Number);
  const [a2, m2] = dernier.split('-').map(Number);
  const ecart = (a2! - a1!) * 12 + (m2! - m1!);
  return ecart > 0 ? ecart : null;
}
