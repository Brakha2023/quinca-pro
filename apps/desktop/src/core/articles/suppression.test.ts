import { describe, expect, it } from 'vitest';
import {
  AUCUN_USAGE, articleUtilise, motifNonSupprimable, resumeUsages, usagesArticle,
} from './suppression';

const article = { code: 'CIM-50', designation: 'Ciment 50 kg' };

describe('usagesArticle', () => {
  it('compte zéro pour ce qui n’a pas été compté', () => {
    expect(usagesArticle({ ventes: 3 })).toEqual({ ...AUCUN_USAGE, ventes: 3 });
  });
});

describe('resumeUsages', () => {
  it('ne dit que ce qui retient l’article', () => {
    expect(resumeUsages(usagesArticle({ ventes: 2, depots: 1 }))).toEqual([
      '2 ligne(s) de vente', 'du stock dans 1 dépôt(s)',
    ]);
  });

  it('ne dit rien d’un article neuf', () => {
    expect(resumeUsages(AUCUN_USAGE)).toEqual([]);
    expect(articleUtilise(AUCUN_USAGE)).toBe(false);
  });

  // Une ligne de stock survit au retour à zéro : c'est la trace qui ne vieillit pas.
  it('retient un article dont le dépôt est vide', () => {
    expect(articleUtilise(usagesArticle({ depots: 1 }))).toBe(true);
  });
});

describe('motifNonSupprimable', () => {
  it('laisse partir un article qui n’a jamais servi', () => {
    expect(motifNonSupprimable(article, AUCUN_USAGE)).toBeNull();
  });

  it('dit ce qui retient l’article, et quoi faire à la place', () => {
    const motif = motifNonSupprimable(article, usagesArticle({ ventes: 4, mouvements: 7 }));
    expect(motif).toContain('CIM-50');
    expect(motif).toContain('4 ligne(s) de vente');
    expect(motif).toContain('7 mouvement(s) de stock');
    expect(motif).toContain('Désactivez-le');
  });

  // Le brouillon se défait en un geste : le message envoie au bon endroit.
  it('renvoie au brouillon quand c’est la seule attache', () => {
    const motif = motifNonSupprimable(article, usagesArticle({ brouillons: 1 }));
    expect(motif).toContain('brouillon');
    expect(motif).not.toContain('Désactivez-le');
  });

  it('parle de l’histoire dès qu’autre chose le retient aussi', () => {
    expect(motifNonSupprimable(article, usagesArticle({ brouillons: 1, ventes: 1 }))).toContain('Désactivez-le');
  });
});
