import { describe, expect, it } from 'vitest';
import { grouperMilliers, lireMontant, margePourcent, montantApresRemise, prixHtDepuisTtc, prixTtcDepuisHt } from './prix';

describe('prix', () => {
  it('convertit TTC ↔ HT avec la TVA', () => {
    expect(prixHtDepuisTtc(11800, 18)).toBe(10000);
    expect(prixTtcDepuisHt(10000, 18)).toBe(11800);
    expect(prixHtDepuisTtc(1000, 0)).toBe(1000);
  });

  it('calcule la marge en % du prix d’achat', () => {
    expect(margePourcent(1000, 1200)).toBe(20);
    expect(margePourcent(1000, 900)).toBe(-10);
    expect(margePourcent(0, 500)).toBe(0);
  });
});

describe('montantApresRemise', () => {
  it('déduit la remise', () => {
    expect(montantApresRemise(10000, 10)).toBe(9000);
    expect(montantApresRemise(1000, 0)).toBe(1000);
  });

  it('borne la remise à [0, 100]', () => {
    expect(montantApresRemise(1000, -5)).toBe(1000);
    expect(montantApresRemise(1000, 150)).toBe(0);
  });

  it('traite une remise absente comme nulle plutôt que de propager un NaN', () => {
    expect(montantApresRemise(1000, undefined)).toBe(1000);
    expect(montantApresRemise(1000, null)).toBe(1000);
    expect(montantApresRemise(1000, Number.NaN)).toBe(1000);
  });
});

describe('saisie des montants', () => {
  it('groupe les milliers avec une espace fine insécable', () => {
    expect(grouperMilliers(1250000)).toBe('1 250 000');
    expect(grouperMilliers(999)).toBe('999');
    expect(grouperMilliers(0)).toBe('0');
    expect(grouperMilliers(-45000)).toBe('-45 000');
  });

  it('ne garde que les chiffres de ce qui est saisi ou collé', () => {
    expect(lireMontant('1 250 000 F')).toBe(1250000);
    expect(lireMontant('1.250.000')).toBe(1250000);
    expect(lireMontant('')).toBe(0);
    expect(lireMontant('abc')).toBe(0);
  });

  // Ce qui sort du champ doit pouvoir y rentrer : sinon un montant affiché
  // puis réédité changerait de valeur tout seul.
  it('fait l’aller-retour sans rien perdre', () => {
    for (const montant of [0, 7, 999, 1000, 1250000, 987654321]) {
      expect(lireMontant(grouperMilliers(montant))).toBe(montant);
    }
  });
});
