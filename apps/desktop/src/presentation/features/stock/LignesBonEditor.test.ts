import { describe, expect, it } from 'vitest';
import { remiseSaisie } from './LignesBonEditor';

describe('remiseSaisie', () => {
  it('garde une remise valide', () => {
    expect(remiseSaisie('20')).toBe(20);
    expect(remiseSaisie('7.5')).toBe(7.5);
  });

  it('borne la saisie à 100 au lieu de laisser le total tomber à zéro', () => {
    expect(remiseSaisie('150')).toBe(100);
  });

  it('ramène à zéro une saisie négative, vide ou illisible', () => {
    expect(remiseSaisie('-5')).toBe(0);
    expect(remiseSaisie('')).toBe(0);
    expect(remiseSaisie('abc')).toBe(0);
  });
});
