import { describe, expect, it } from 'vitest';
import {
  libellePagination, listePlafonnee, numerosDePage, paginer, trancher,
  TAILLE_PAGE_DEFAUT,
} from './pagination';

const lignes = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

describe('paginer', () => {
  it('découpe une liste en pages', () => {
    expect(paginer(312, 1, 50)).toMatchObject({ page: 1, pages: 7, debut: 0, fin: 50, premier: 1, dernier: 50 });
    expect(paginer(312, 4, 50)).toMatchObject({ page: 4, debut: 150, fin: 200, premier: 151, dernier: 200 });
    // La dernière page n'est pleine que par hasard : 312 = 6 × 50 + 12.
    expect(paginer(312, 7, 50)).toMatchObject({ page: 7, debut: 300, fin: 312, premier: 301, dernier: 312 });
  });

  it('compte au moins une page, même sans rien à montrer', () => {
    expect(paginer(0, 1, 50)).toMatchObject({ pages: 1, total: 0, premier: 0, dernier: 0, pageUnique: true });
  });

  /**
   * Le cas de tous les jours : on est en page sept, on tape trois lettres dans
   * la recherche, et il ne reste que douze lignes. Rester en page sept
   * afficherait un tableau vide alors que la liste n'est pas vide.
   */
  it('ramène une page devenue hors bornes à la dernière', () => {
    expect(paginer(12, 7, 50).page).toBe(1);
    expect(paginer(120, 9, 25).page).toBe(5);
  });

  it('se défend d’une page ou d’une taille absurdes', () => {
    expect(paginer(100, 0, 50).page).toBe(1);
    expect(paginer(100, -3, 50).page).toBe(1);
    expect(paginer(100, 1, 0).taille).toBe(1);
    expect(paginer(-5, 1, 50).total).toBe(0);
    expect(paginer(100, Number.NaN, 50).page).toBe(1);
  });

  it('dit qu’une page unique est une page unique', () => {
    expect(paginer(50, 1, 50).pageUnique).toBe(true);
    expect(paginer(51, 1, 50).pageUnique).toBe(false);
  });
});

describe('trancher', () => {
  it('rend la tranche de la page courante', () => {
    const cent = lignes(100);
    expect(trancher(cent, paginer(100, 1, 25))).toEqual(lignes(25));
    expect(trancher(cent, paginer(100, 4, 25))[0]).toBe(76);
    expect(trancher(cent, paginer(100, 4, 25))).toHaveLength(25);
  });

  it('rend une dernière page incomplète sans rien inventer', () => {
    expect(trancher(lignes(12), paginer(12, 1, 50))).toHaveLength(12);
  });

  /** Les tranches mises bout à bout doivent redonner la liste entière. */
  it('ne perd ni ne répète aucune ligne', () => {
    const toutes = lignes(312);
    const remises: number[] = [];
    for (let p = 1; p <= paginer(312, 1, 50).pages; p++) remises.push(...trancher(toutes, paginer(312, p, 50)));
    expect(remises).toEqual(toutes);
  });
});

describe('libellePagination', () => {
  it('annonce le total quand tout tient sur une page', () => {
    expect(libellePagination(paginer(1, 1, 50), 'article')).toBe('1 article');
    expect(libellePagination(paginer(12, 1, 50), 'article')).toBe('12 articles');
  });

  it('annonce la tranche quand il y en a plusieurs', () => {
    expect(libellePagination(paginer(312, 2, 50), 'article')).toBe('51 à 100 sur 312 articles');
  });

  it('le dit quand il n’y a rien', () => {
    expect(libellePagination(paginer(0, 1, 50), 'client')).toBe('Aucun client');
  });
});

describe('numerosDePage', () => {
  it('rend toutes les pages quand elles sont peu nombreuses', () => {
    expect(numerosDePage(paginer(200, 3, 50))).toEqual([1, 2, 3, 4]);
  });

  it('garde la première, la dernière et les voisines, et marque les trous', () => {
    expect(numerosDePage(paginer(3000, 15, 50))).toEqual([1, null, 14, 15, 16, null, 60]);
    expect(numerosDePage(paginer(3000, 1, 50))).toEqual([1, 2, null, 60]);
    expect(numerosDePage(paginer(3000, 60, 50))).toEqual([1, null, 59, 60]);
  });

  /** Des points de suspension pour cacher une seule page seraient ridicules. */
  it('comble un trou d’une seule page au lieu de l’élider', () => {
    expect(numerosDePage(paginer(200, 1, 50))).toEqual([1, 2, 3, 4]);
    expect(numerosDePage(paginer(250, 3, 50))).toEqual([1, 2, 3, 4, 5]);
  });

  it('garde une largeur constante d’une page à l’autre', () => {
    const largeurs = new Set<number>();
    for (let p = 4; p <= 57; p++) largeurs.add(numerosDePage(paginer(3000, p, 50)).length);
    expect([...largeurs]).toEqual([7]);
  });
});

describe('listePlafonnee', () => {
  it('signale une liste qui s’arrête pile au plafond de sa requête', () => {
    expect(listePlafonnee(500, 500)).toBe(true);
    expect(listePlafonnee(499, 500)).toBe(false);
  });

  it('ne dit rien quand la requête n’a pas de plafond', () => {
    expect(listePlafonnee(5000, null)).toBe(false);
    expect(listePlafonnee(5000, undefined)).toBe(false);
  });
});

describe('TAILLE_PAGE_DEFAUT', () => {
  it('fait partie des tailles proposées', () => {
    expect(paginer(1000, 1, TAILLE_PAGE_DEFAUT).taille).toBe(50);
  });
});
