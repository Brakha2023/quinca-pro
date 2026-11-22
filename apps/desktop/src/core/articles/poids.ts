import type { Article } from './article';

/**
 * Le tonnage d'un bon, déduit du poids unitaire des articles.
 *
 * Pourquoi la tonne et pas le kilo : ce chiffre ne sert qu'à une décision,
 * celle du chargement. « Ça fait combien de tonnes ? » est la question du
 * patron devant un bon de 400 sacs de ciment, et la réponse va sur le devis du
 * transporteur. Le kilo obligerait à diviser de tête à chaque fois.
 *
 * Rien ici n'est stocké. Le poids vit sur la fiche article (un sac de ciment
 * pèse toujours 50 kg), le tonnage se recalcule à chaque affichage : il ne peut
 * donc pas divorcer des quantités du bon.
 */

/** Trois décimales : le gramme près sur une tonne, et pas de 0,30000000000000004. */
export const arrondirTonnage = (tonnes: number): number => Math.round(tonnes * 1000) / 1000;

export interface LignePesee {
  article: Pick<Article, 'poids_tonnes'>;
  quantite: number;
}

/**
 * Le poids d'une ligne, ou `null` si l'article n'en porte pas.
 *
 * `null` n'est pas zéro : un article sans poids renseigné ne pèse pas rien, on
 * ignore ce qu'il pèse. La distinction se voit à l'écran — une ligne sans
 * poids affiche un tiret, pas « 0 t » — et c'est elle qui évite d'annoncer au
 * transporteur un tonnage amputé des articles non renseignés.
 */
export function poidsLigne(ligne: LignePesee): number | null {
  const unitaire = ligne.article.poids_tonnes;
  if (unitaire == null) return null;
  return arrondirTonnage(unitaire * ligne.quantite);
}

/** Vrai dès qu'un article du bon porte un poids : c'est ce qui fait apparaître la colonne. */
export const bonPorteUnPoids = (lignes: readonly LignePesee[]): boolean =>
  lignes.some((l) => l.article.poids_tonnes != null);

/** Le tonnage total, somme des lignes pesées. Les lignes sans poids n'y entrent pas. */
export const tonnageBon = (lignes: readonly LignePesee[]): number =>
  arrondirTonnage(lignes.reduce((somme, l) => somme + (poidsLigne(l) ?? 0), 0));

/** Vrai si une partie seulement des lignes est pesée : le total annoncé est alors partiel. */
export const tonnagePartiel = (lignes: readonly LignePesee[]): boolean =>
  bonPorteUnPoids(lignes) && lignes.some((l) => l.article.poids_tonnes == null);

/**
 * « 1,25 t », « 0,05 t », et un tiret pour ce qui n'est pas pesé.
 *
 * Les décimales ne s'affichent que si elles existent : un camion de 20 tonnes
 * s'écrit « 20 t » et non « 20,000 t ».
 */
export function formaterTonnage(tonnes: number | null): string {
  if (tonnes == null) return '—';
  return `${arrondirTonnage(tonnes).toLocaleString('fr-FR', { maximumFractionDigits: 3 })} t`;
}
