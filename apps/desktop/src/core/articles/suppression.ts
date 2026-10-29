import type { Article } from './article';

/**
 * Supprimer un article — ou le désactiver.
 *
 * Un article qui a servi ne se supprime pas : ses lignes de vente, ses
 * mouvements de stock et ses commandes le nomment encore, et le serveur
 * refuserait d'ailleurs l'effacement (clés étrangères). Pour celui-là, le bon
 * geste est de le **désactiver** : il quitte le comptoir, son histoire reste.
 *
 * Reste le cas d'une faute de frappe, d'un doublon, d'un import malheureux :
 * un article créé puis jamais utilisé encombre le catalogue sans rien raconter.
 * Celui-là s'efface, et ce module dit à quelles conditions.
 *
 * ### Pourquoi compter les dépôts
 *
 * Une ligne de `stocks` naît au **premier mouvement** de l'article dans un
 * dépôt, et ne disparaît plus — même revenue à zéro (voir `StockRepository`).
 * C'est la seule trace qui ne vieillisse pas : les tables d'activité, elles,
 * ne sont synchronisées que sur douze mois (`dans_fenetre`). Un article vendu
 * il y a trois ans n'a donc plus de ligne de vente sur le poste, mais il a
 * toujours sa ligne de stock. D'où l'ordre des vérifications : le poste pour
 * répondre tout de suite, le serveur pour trancher (voir `ArticlesRepository`).
 */

/** Ce qui rattache un article à l'activité. Un seul suffit à le retenir. */
export interface UsagesArticle {
  /** Lignes de stock : l'article est entré dans un dépôt au moins une fois. */
  depots: number;
  mouvements: number;
  ventes: number;
  devis: number;
  commandes: number;
  fabrications: number;
  transferts: number;
  /** Ventes mises de côté qui le contiennent encore. */
  brouillons: number;
}

export const AUCUN_USAGE: UsagesArticle = {
  depots: 0, mouvements: 0, ventes: 0, devis: 0,
  commandes: 0, fabrications: 0, transferts: 0, brouillons: 0,
};

/** Dans l'ordre où on les dit : ce qui parle le plus d'abord. */
const LIBELLES: Array<[keyof UsagesArticle, (n: number) => string]> = [
  ['ventes', (n) => `${n} ligne(s) de vente`],
  ['mouvements', (n) => `${n} mouvement(s) de stock`],
  ['depots', (n) => `du stock dans ${n} dépôt(s)`],
  ['commandes', (n) => `${n} ligne(s) de commande fournisseur`],
  ['devis', (n) => `${n} ligne(s) de devis`],
  ['fabrications', (n) => `${n} ligne(s) de fabrication`],
  ['transferts', (n) => `${n} transfert(s) entre filiales`],
  ['brouillons', (n) => `${n} vente(s) en brouillon`],
];

/** Complète ce qui n'a pas été compté : une table absente vaut zéro usage. */
export function usagesArticle(partiel: Partial<UsagesArticle>): UsagesArticle {
  return { ...AUCUN_USAGE, ...partiel };
}

/** Ce qui retient l'article, dit en clair. Vide : rien ne le retient. */
export function resumeUsages(usages: UsagesArticle): string[] {
  return LIBELLES.filter(([clef]) => (usages[clef] ?? 0) > 0).map(([clef, dire]) => dire(usages[clef]));
}

export function articleUtilise(usages: UsagesArticle): boolean {
  return resumeUsages(usages).length > 0;
}

/**
 * Pourquoi cet article ne peut pas être supprimé — ou `null` s'il peut l'être.
 * Le message est celui qu'on montre : il dit quoi faire, pas seulement non.
 */
export function motifNonSupprimable(
  article: Pick<Article, 'code' | 'designation'>,
  usages: UsagesArticle,
): string | null {
  const resume = resumeUsages(usages);
  if (resume.length === 0) return null;

  const nom = `« ${article.code} — ${article.designation} »`;
  // Un brouillon est la seule attache qui se défait en un geste : rien n'est
  // vendu, il suffit de reprendre ou de jeter le ticket.
  if (resume.length === 1 && usages.brouillons > 0) {
    return `L'article ${nom} est encore dans ${usages.brouillons} vente(s) en brouillon : reprenez-les ou jetez-les, puis supprimez l'article.`;
  }
  return `L'article ${nom} a déjà servi (${resume.join(', ')}) : le supprimer effacerait cette trace. Désactivez-le — il quitte le comptoir, son histoire reste.`;
}
