import { arrondirFcfa } from '../commun/prix';

/**
 * L'état du stock, article par article.
 *
 * Un gérant ne veut pas savoir combien de références il détient : il veut
 * savoir **où dort son argent** et **ce qu'il ne peut plus vendre**. D'où quatre
 * états, et un seul par article — un article ne peut pas être à la fois en
 * rupture et dormant, sinon le total ne voudrait plus rien dire.
 *
 * L'ordre de priorité n'est pas arbitraire, il suit l'urgence de la décision :
 *
 *   1. **rupture** — quantité nulle ou négative : on ne peut plus servir ;
 *   2. **dormant** — en stock mais immobile depuis trois mois : l'argent dort,
 *      et c'est le seul état qu'on ne voit jamais venir tout seul ;
 *   3. **sous le minimum** — il reste de quoi vendre, mais il faut commander ;
 *   4. **actif** — rien à décider.
 *
 * Un article dormant **et** sous son minimum reste dormant : le recommander
 * serait exactement la mauvaise décision.
 */

/** Au-delà de ce silence, l'argent dort. Trois mois : un trimestre de saison. */
export const JOURS_AVANT_DORMANT = 90;

export const ETATS_STOCK = ['RUPTURE', 'DORMANT', 'SOUS_MINIMUM', 'ACTIF'] as const;
export type EtatStock = (typeof ETATS_STOCK)[number];

export const LIBELLES_ETAT_STOCK: Record<EtatStock, string> = {
  RUPTURE: 'En rupture',
  DORMANT: 'Dormant',
  SOUS_MINIMUM: 'Sous le minimum',
  ACTIF: 'Actif',
};

/** Ce que chaque état appelle comme décision — écrit sous le graphique. */
export const CONSEILS_ETAT_STOCK: Record<EtatStock, string> = {
  RUPTURE: 'à commander d’urgence',
  DORMANT: `sans mouvement depuis ${JOURS_AVANT_DORMANT} jours`,
  SOUS_MINIMUM: 'à réapprovisionner',
  ACTIF: 'rien à décider',
};

/** Un article de la filiale, quantités et valeur cumulées sur ses dépôts. */
export interface LigneStockPilotage {
  article_id: string;
  code: string;
  designation: string;
  quantite: number;
  stock_min: number;
  valeur: number;
  /** Dernier mouvement, tous dépôts confondus. Nul : l'article n'a jamais bougé. */
  dernier_mouvement: string | null;
}

export function classerStock(ligne: LigneStockPilotage, maintenant: Date = new Date()): EtatStock {
  if (ligne.quantite <= 0) return 'RUPTURE';

  const limite = new Date(maintenant);
  limite.setDate(limite.getDate() - JOURS_AVANT_DORMANT);
  // Un article qui n'a jamais bougé est dormant : il est entré et n'est jamais ressorti.
  if (!ligne.dernier_mouvement || ligne.dernier_mouvement < limite.toISOString()) return 'DORMANT';

  if (ligne.stock_min > 0 && ligne.quantite <= ligne.stock_min) return 'SOUS_MINIMUM';
  return 'ACTIF';
}

export interface PartStock {
  etat: EtatStock;
  libelle: string;
  articles: number;
  valeur: number;
  /** Part de la valeur totale, en %. */
  part: number;
  /**
   * Part du nombre d'articles, en %. Les deux parts ne disent pas la même
   * chose et il faut les deux : une rupture ne vaut rien — elle n'apparaîtrait
   * jamais sur une barre valorisée, alors que c'est l'état le plus urgent.
   */
  part_articles: number;
}

export interface RepartitionStock {
  parts: PartStock[];
  articles: number;
  valeur: number;
  /** Valeur immobilisée sans contrepartie : dormant. */
  valeur_dormante: number;
  ruptures: number;
}

/**
 * Répartition par état. Les quatre états sont toujours présents, même à zéro :
 * une légende qui change de taille d'un jour à l'autre ne se lit pas.
 */
export function repartitionStock(lignes: LigneStockPilotage[], maintenant: Date = new Date()): RepartitionStock {
  const seaux = new Map<EtatStock, { articles: number; valeur: number }>(
    ETATS_STOCK.map((e) => [e, { articles: 0, valeur: 0 }]),
  );
  for (const ligne of lignes) {
    const seau = seaux.get(classerStock(ligne, maintenant))!;
    seau.articles += 1;
    // Un stock négatif ne vaut pas moins que rien : il vaut zéro, et il manque.
    seau.valeur += Math.max(ligne.valeur, 0);
  }

  const valeur = arrondirFcfa([...seaux.values()].reduce((t, s) => t + s.valeur, 0));
  const articles = [...seaux.values()].reduce((t, s) => t + s.articles, 0);


  return {
    parts: ETATS_STOCK.map((etat) => {
      const s = seaux.get(etat)!;
      return {
        etat,
        libelle: LIBELLES_ETAT_STOCK[etat],
        articles: s.articles,
        valeur: arrondirFcfa(s.valeur),
        part: valeur > 0 ? Math.round((s.valeur / valeur) * 1000) / 10 : 0,
        part_articles: articles > 0 ? Math.round((s.articles / articles) * 1000) / 10 : 0,
      };
    }),
    articles,
    valeur,
    valeur_dormante: arrondirFcfa(seaux.get('DORMANT')!.valeur),
    ruptures: seaux.get('RUPTURE')!.articles,
  };
}

/** Les articles dormants les plus coûteux : par où commencer à déstocker. */
export function dormantsLesPlusLourds(
  lignes: LigneStockPilotage[],
  limite = 5,
  maintenant: Date = new Date(),
): LigneStockPilotage[] {
  return lignes
    .filter((l) => classerStock(l, maintenant) === 'DORMANT')
    .sort((a, b) => b.valeur - a.valeur)
    .slice(0, limite);
}
