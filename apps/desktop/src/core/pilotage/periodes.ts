/**
 * Périodes du tableau de bord.
 *
 * Quatre fenêtres, et une seule règle : la granularité suit la durée. Sur un
 * mois, un histogramme par jour se lit ; sur un an, il ferait trois cent
 * soixante-cinq barres illisibles — c'est le mois qui devient la barre.
 */

export type Periode = 'JOUR' | 'SEMAINE' | 'MOIS' | 'ANNEE';

export type Granularite = 'JOUR' | 'MOIS';

export interface Fenetre {
  periode: Periode;
  /** Bornes ISO complètes, prêtes pour `BETWEEN` : début de journée, fin de journée. */
  debut: string;
  fin: string;
  /** Premier et dernier jour, en `AAAA-MM-JJ`. */
  jourDebut: string;
  jourFin: string;
  granularite: Granularite;
  libelle: string;
}

export const PERIODES: Array<{ id: Periode; label: string }> = [
  { id: 'JOUR', label: "Aujourd'hui" },
  { id: 'SEMAINE', label: '7 jours' },
  { id: 'MOIS', label: 'Ce mois' },
  { id: 'ANNEE', label: '12 mois' },
];

export const jourIso = (d: Date): string => d.toISOString().slice(0, 10);
export const debutDuJour = (jour: string): string => `${jour}T00:00:00.000Z`;
export const finDuJour = (jour: string): string => `${jour}T23:59:59.999Z`;

const enFrancais = (jour: string, options: Intl.DateTimeFormatOptions): string =>
  new Date(`${jour}T12:00:00`).toLocaleDateString('fr-FR', options);

/** Recule de `n` jours sans toucher à la date d'origine. */
function moins(jours: number, depuis: Date): Date {
  const d = new Date(depuis);
  d.setDate(d.getDate() - jours);
  return d;
}

export function fenetrePilotage(periode: Periode, aujourdhui: Date = new Date()): Fenetre {
  const jourFin = jourIso(aujourdhui);

  const bornes: Record<Periode, { jourDebut: string; granularite: Granularite; libelle: string }> = {
    JOUR: {
      jourDebut: jourFin,
      granularite: 'JOUR',
      libelle: enFrancais(jourFin, { weekday: 'long', day: 'numeric', month: 'long' }),
    },
    SEMAINE: {
      jourDebut: jourIso(moins(6, aujourdhui)),
      granularite: 'JOUR',
      libelle: `du ${enFrancais(jourIso(moins(6, aujourdhui)), { day: '2-digit', month: 'short' })} au ${enFrancais(jourFin, { day: '2-digit', month: 'short' })}`,
    },
    MOIS: {
      jourDebut: `${jourFin.slice(0, 7)}-01`,
      granularite: 'JOUR',
      libelle: enFrancais(jourFin, { month: 'long', year: 'numeric' }),
    },
    ANNEE: {
      // Onze mois pleins derrière nous, plus le mois en cours : douze barres.
      jourDebut: `${new Date(Date.UTC(aujourdhui.getFullYear(), aujourdhui.getMonth() - 11, 1)).toISOString().slice(0, 7)}-01`,
      granularite: 'MOIS',
      libelle: `12 derniers mois`,
    },
  };

  const { jourDebut, granularite, libelle } = bornes[periode];
  return { periode, jourDebut, jourFin, debut: debutDuJour(jourDebut), fin: finDuJour(jourFin), granularite, libelle };
}

/**
 * La période précédente, de même durée : c'est elle qui donne l'évolution.
 * « +12 % » ne veut rien dire sans dire par rapport à quoi.
 */
export function fenetrePrecedente(fenetre: Fenetre): Fenetre {
  const debut = new Date(`${fenetre.jourDebut}T12:00:00Z`);
  const fin = new Date(`${fenetre.jourFin}T12:00:00Z`);
  const jours = Math.round((fin.getTime() - debut.getTime()) / 86_400_000) + 1;
  const finPrecedente = moins(jours, fin);
  const debutPrecedent = moins(jours, debut);
  return {
    ...fenetre,
    jourDebut: jourIso(debutPrecedent),
    jourFin: jourIso(finPrecedente),
    debut: debutDuJour(jourIso(debutPrecedent)),
    fin: finDuJour(jourIso(finPrecedente)),
    libelle: jours === 1 ? 'la veille' : `les ${jours} jours précédents`,
  };
}

/**
 * Les cases de l'histogramme, vides comprises : un jour sans vente est une
 * barre à zéro, pas un trou dans la série.
 */
export function casesDeLaFenetre(fenetre: Fenetre): string[] {
  if (fenetre.granularite === 'MOIS') {
    const cases: string[] = [];
    const [annee, mois] = fenetre.jourDebut.split('-').map(Number);
    const d = new Date(Date.UTC(annee!, mois! - 1, 1));
    const borne = fenetre.jourFin.slice(0, 7);
    while (d.toISOString().slice(0, 7) <= borne) {
      cases.push(d.toISOString().slice(0, 7));
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
    return cases;
  }
  const cases: string[] = [];
  const d = new Date(`${fenetre.jourDebut}T12:00:00Z`);
  const fin = new Date(`${fenetre.jourFin}T12:00:00Z`);
  while (d <= fin) {
    cases.push(jourIso(d));
    d.setDate(d.getDate() + 1);
  }
  return cases;
}

/** Étiquette d'une case sous l'histogramme : courte, elle doit tenir sous la barre. */
export function libelleCase(cle: string, granularite: Granularite): string {
  if (granularite === 'MOIS') {
    const [annee, mois] = cle.split('-').map(Number);
    return new Date(Date.UTC(annee!, mois! - 1, 1)).toLocaleDateString('fr-FR', { month: 'short' });
  }
  return enFrancais(cle, { day: '2-digit', month: '2-digit' });
}
