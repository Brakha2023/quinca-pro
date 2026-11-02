import { arrondirFcfa, arrondirMontant } from '../commun/prix';

/**
 * Répartition d'une remise négociée sur **le bon entier**.
 *
 * C'est ainsi que la remise se négocie avec un fournisseur : « je vous fais
 * 15 000 sur le tout », en francs, jamais en pourcentage ligne par ligne. Le
 * stock, lui, se valorise article par article : le rabais doit donc être
 * redescendu sur les lignes, et il l'est **au prorata de la valeur de chaque
 * ligne** — la ligne qui pèse le plus dans le bon porte la plus grosse part.
 *
 * Deux garde-fous :
 *
 * - une ligne sans coût saisi ne porte rien : on ne sait pas ce qu'elle vaut,
 *   lui attribuer une part de remise donnerait un coût négatif ;
 * - les francs ne se divisent pas toujours : le reste de l'arrondi est donné à
 *   la ligne la plus lourde, de sorte que la somme des parts **égale
 *   exactement** la remise accordée. Sans cela le bon et le compte du
 *   fournisseur ne tomberaient pas sur le même franc.
 */
export interface LigneAValoriser {
  quantite: number;
  /** Coût unitaire brut, avant remise ; vide quand il n'est pas renseigné. */
  cout_unitaire: number | '';
}

export interface PartRemise<L> {
  ligne: L;
  /** Valeur brute de la ligne : quantité × coût unitaire. */
  brut: number;
  /** Part de la remise du bon portée par cette ligne, en francs. */
  remise: number;
  /** Coût unitaire net de cette part ; null quand aucun coût n'est saisi. */
  cout_unitaire_net: number | null;
}

const brutLigne = (l: LigneAValoriser): number => (l.cout_unitaire === '' ? 0 : arrondirMontant(l.quantite * l.cout_unitaire));

/** Total brut d'un bon : la somme des lignes valorisées, avant remise. */
export const totalBrutBon = (lignes: readonly LigneAValoriser[]): number =>
  arrondirMontant(lignes.reduce((s, l) => s + brutLigne(l), 0));

/** Total net d'un bon : son brut moins la remise accordée, jamais négatif. */
export const totalNetBon = (lignes: readonly LigneAValoriser[], remise: number): number =>
  Math.max(arrondirMontant(totalBrutBon(lignes) - Math.max(remise, 0)), 0);

export function repartirRemiseGlobale<L extends LigneAValoriser>(lignes: readonly L[], remise: number): Array<PartRemise<L>> {
  const brut = totalBrutBon(lignes);
  const aRepartir = Number.isFinite(remise) ? Math.min(Math.max(remise, 0), brut) : 0;
  const parts = lignes.map<PartRemise<L>>((ligne) => ({
    ligne,
    brut: brutLigne(ligne),
    remise: 0,
    cout_unitaire_net: ligne.cout_unitaire === '' ? null : ligne.cout_unitaire,
  }));
  if (aRepartir <= 0 || brut <= 0) return parts;

  const valorisees = parts.filter((p) => p.brut > 0);
  for (const part of valorisees) part.remise = arrondirFcfa((aRepartir * part.brut) / brut);
  // Le reste de l'arrondi va à la ligne la plus lourde : c'est là qu'un franc
  // de plus ou de moins se voit le moins sur le coût unitaire.
  const laPlusLourde = valorisees.reduce((a, b) => (b.brut > a.brut ? b : a));
  laPlusLourde.remise = arrondirFcfa(laPlusLourde.remise + (aRepartir - valorisees.reduce((s, p) => s + p.remise, 0)));

  for (const part of valorisees) {
    part.cout_unitaire_net = part.ligne.quantite > 0 ? arrondirMontant((part.brut - part.remise) / part.ligne.quantite) : 0;
  }
  return parts;
}
