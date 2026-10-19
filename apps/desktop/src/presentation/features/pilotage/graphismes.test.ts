import { describe, expect, it } from 'vitest';
import { ECHELLE_ANCIENNETE, graduations } from './graphismes';

describe('graduations', () => {
  it('donne des marches rondes', () => {
    expect(graduations(1_000_000)).toEqual([0, 250_000, 500_000, 750_000, 1_000_000]);
    expect(graduations(37_000)).toEqual([0, 10_000, 20_000, 30_000, 40_000]);
  });

  it('couvre toujours le maximum', () => {
    for (const max of [1, 7, 999, 1234, 98_765, 4_300_000]) {
      expect(graduations(max).at(-1)).toBeGreaterThanOrEqual(max);
    }
  });

  it('ne répète jamais une marche, même sur une période sans vente', () => {
    // L'échelle vaut 1 quand rien n'a été vendu : sous l'unité, l'arrondi
    // rendait 0, 0, 1, 1 — et React deux fois la même clé.
    for (const max of [1, 2, 3, 4, 5]) {
      const g = graduations(max);
      expect(new Set(g).size).toBe(g.length);
    }
  });

  it('rend une seule marche quand il n’y a rien à graduer', () => {
    expect(graduations(0)).toEqual([0]);
    expect(graduations(-5)).toEqual([0]);
  });
});

describe('échelle d’ancienneté', () => {
  it('a autant de marches que de tranches', () => {
    expect(ECHELLE_ANCIENNETE).toHaveLength(4);
  });
});
