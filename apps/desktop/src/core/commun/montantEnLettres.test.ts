import { describe, expect, it } from 'vitest';
import { montantEnLettres, montantEnLettresFcfa } from './montantEnLettres';

describe('montantEnLettres', () => {
  it.each([
    [0, 'zéro'],
    [1, 'un'],
    [16, 'seize'],
    [21, 'vingt et un'],
    [71, 'soixante et onze'],
    [80, 'quatre-vingts'],
    [81, 'quatre-vingt-un'],
    [91, 'quatre-vingt-onze'],
    [100, 'cent'],
    [200, 'deux cents'],
    [201, 'deux cent un'],
    [1_000, 'mille'],
    [1_500, 'mille cinq cents'],
    [2_000, 'deux mille'],
    [1_000_000, 'un million'],
    [2_000_000, 'deux millions'],
  ])('%i → %s', (montant, lettres) => {
    expect(montantEnLettres(montant)).toBe(lettres);
  });

  it('écrit le montant du reçu de la capture', () => {
    expect(montantEnLettres(375_500)).toBe('trois cent soixante-quinze mille cinq cents');
  });

  it('arrondit au franc : le FCFA n’a pas de centime', () => {
    expect(montantEnLettres(949.05)).toBe('neuf cent quarante-neuf');
  });

  it('dit « moins » devant un montant négatif', () => {
    expect(montantEnLettres(-50)).toBe('moins cinquante');
  });

  it('accole la devise, accordée', () => {
    expect(montantEnLettresFcfa(1)).toBe('un franc CFA');
    expect(montantEnLettresFcfa(375_500)).toBe('trois cent soixante-quinze mille cinq cents francs CFA');
  });
});
