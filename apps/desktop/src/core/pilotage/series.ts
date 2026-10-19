import { arrondirFcfa } from '../commun/prix';
import { casesDeLaFenetre, libelleCase, type Fenetre } from './periodes';

/**
 * La série de l'histogramme : une barre par jour (ou par mois), coupée en deux
 * — ce que la marchandise a coûté, et ce qu'elle a rapporté. Les deux
 * empilées font le chiffre d'affaires, et la part haute se lit comme la marge.
 *
 * C'est le seul graphique du tableau de bord qui porte deux séries : elles
 * partagent la même unité et le même axe, et leur somme a un sens. Deux
 * échelles sur un même dessin inventeraient une corrélation qui n'existe pas.
 */

export interface PointBrut {
  /** `AAAA-MM-JJ` ou `AAAA-MM`, selon la granularité de la fenêtre. */
  cle: string;
  ca_ht: number;
  cout: number;
  ventes: number;
}

export interface PointSerie {
  cle: string;
  libelle: string;
  ca_ht: number;
  cout: number;
  marge: number;
  ventes: number;
}

export interface SerieCaMarge {
  points: PointSerie[];
  /** Plus haute barre : l'échelle de l'axe. Jamais nulle, sinon tout déborde. */
  maximum: number;
  total_ca: number;
  total_marge: number;
  total_ventes: number;
  /** Moyenne par case non vide : la ligne de repère du graphique. */
  moyenne: number;
}

export function serieCaMarge(bruts: PointBrut[], fenetre: Fenetre): SerieCaMarge {
  const parCle = new Map(bruts.map((b) => [b.cle, b]));

  const points: PointSerie[] = casesDeLaFenetre(fenetre).map((cle) => {
    const b = parCle.get(cle);
    const ca_ht = arrondirFcfa(b?.ca_ht ?? 0);
    // Le coût ne peut pas dépasser le chiffre d'affaires dans la pile : une
    // vente à perte se lit à la marge négative, pas à une barre qui déborde.
    const cout = arrondirFcfa(b?.cout ?? 0);
    return { cle, libelle: libelleCase(cle, fenetre.granularite), ca_ht, cout, marge: arrondirFcfa(ca_ht - cout), ventes: b?.ventes ?? 0 };
  });

  const avecActivite = points.filter((p) => p.ca_ht !== 0 || p.cout !== 0);
  const total_ca = arrondirFcfa(points.reduce((t, p) => t + p.ca_ht, 0));

  return {
    points,
    maximum: Math.max(...points.map((p) => Math.max(p.ca_ht, p.cout)), 1),
    total_ca,
    total_marge: arrondirFcfa(points.reduce((t, p) => t + p.marge, 0)),
    total_ventes: points.reduce((t, p) => t + p.ventes, 0),
    moyenne: avecActivite.length > 0 ? arrondirFcfa(total_ca / avecActivite.length) : 0,
  };
}

/**
 * Un classement : familles d'articles, filiales, clients. Toujours la même
 * forme — un libellé, une valeur, une part — pour un seul composant de barres.
 */
export interface LigneClassement {
  cle: string;
  libelle: string;
  valeur: number;
  /** Deuxième information, affichée en gris derrière le libellé (quantité, nombre de ventes…). */
  detail?: string;
  part: number;
}

/**
 * Range, calcule les parts, et **replie la queue** : au-delà de `limite`, le
 * reste devient « Autres ». Inventer une couleur de plus pour un neuvième
 * poste ne le rendrait pas lisible.
 */
export function classement(
  lignes: Array<{ cle: string; libelle: string; valeur: number; detail?: string }>,
  limite = 6,
): { lignes: LigneClassement[]; total: number; maximum: number } {
  const total = arrondirFcfa(lignes.reduce((t, l) => t + l.valeur, 0));
  const triees = [...lignes].sort((a, b) => b.valeur - a.valeur);
  const tete = triees.slice(0, limite);
  const queue = triees.slice(limite);

  const retenues = [...tete];
  if (queue.length > 0) {
    retenues.push({
      cle: '__autres__',
      libelle: 'Autres',
      valeur: arrondirFcfa(queue.reduce((t, l) => t + l.valeur, 0)),
      detail: `${queue.length} poste(s)`,
    });
  }

  return {
    lignes: retenues.map((l) => ({ ...l, valeur: arrondirFcfa(l.valeur), part: total > 0 ? Math.round((l.valeur / total) * 1000) / 10 : 0 })),
    total,
    maximum: Math.max(...retenues.map((l) => l.valeur), 1),
  };
}
