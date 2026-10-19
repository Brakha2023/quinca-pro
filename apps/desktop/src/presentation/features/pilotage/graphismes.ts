import type { EtatStock } from '../../../core/pilotage';

/**
 * Les couleurs des graphiques, et rien d'autre.
 *
 * Elles ne sont pas choisies à l'œil : chaque jeu a passé le contrôle de
 * lisibilité (bande de clarté, plancher de saturation, écart entre voisines
 * sous daltonisme, contraste sur fond blanc). Les toucher demande de repasser
 * ce contrôle — l'écart entre deux teintes voisines ne se juge pas de mémoire.
 *
 *   * **deux séries** (coût / marge) : bleu et orange, écart ΔE 24,7 sous
 *     protanopie — très au-dessus du plancher de 8 ;
 *   * **une seule série** (classements) : une teinte, toujours la même ;
 *   * **échelle ordonnée** (ancienneté des créances) : un seul bleu qui
 *     fonce avec l'âge, quatre marches espacées et toutes visibles sur blanc ;
 *   * **états** (stock) : les couleurs d'état, réservées — elles ne servent
 *     jamais de couleur de série, et ne portent jamais seules le sens : un
 *     libellé et un nombre les accompagnent toujours.
 */

/** Deux séries qui s'empilent : ce que la marchandise a coûté, ce qu'elle a rapporté. */
export const SERIE_COUT = '#2a78d6';
export const SERIE_MARGE = '#eb6834';

/** Série unique des classements (familles, clients, filiales). */
export const SERIE_UNIQUE = '#2a78d6';

/** Échelle ordonnée, du plus récent au plus vieux : plus c'est foncé, plus ça traîne. */
export const ECHELLE_ANCIENNETE = ['#86b6ef', '#5598e7', '#2a78d6', '#184f95'];

/** Couleurs d'état, fixes, jamais réemployées comme couleur de série. */
export const COULEURS_ETAT_STOCK: Record<EtatStock, string> = {
  ACTIF: '#0ca30c',
  DORMANT: '#fab219',
  SOUS_MINIMUM: '#ec835a',
  RUPTURE: '#d03b3b',
};

/** Grille et axes : un cran au-dessus du fond, jamais en pointillés. */
export const GRILLE = '#e5e5e5';
/** Le fond sur lequel tout est dessiné : c'est lui qui sépare les marques. */
export const FOND = '#ffffff';

/** Épaisseur maximale d'une barre : au-delà, le dessin devient un bloc. */
export const BARRE_MAX = 24;

/**
 * Graduations rondes pour un axe : 0, puis des multiples lisibles jusqu'au
 * maximum. Un axe gradué à 1 237 450 ne se lit pas.
 */
export function graduations(maximum: number, nombre = 4): number[] {
  if (maximum <= 0) return [0];
  const brut = maximum / nombre;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  // Jamais moins d'un franc entre deux marches : sous l'unité, l'arrondi
  // rendrait deux fois la même graduation sur une période sans vente.
  const pas = Math.max([1, 2, 2.5, 5, 10].map((m) => m * puissance).find((p) => p >= brut) ?? puissance * 10, 1);
  // La dernière marche couvre le maximum, sinon la plus haute barre dépasserait
  // sa propre graduation : c'est l'axe qui donne l'échelle, pas l'inverse.
  const plafond = Math.ceil(maximum / pas) * pas;
  const marches: number[] = [];
  for (let v = 0; v <= plafond + pas / 2; v += pas) marches.push(Math.round(v));
  return marches;
}
