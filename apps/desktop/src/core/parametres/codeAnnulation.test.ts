import { describe, expect, it } from 'vitest';
import {
  LONGUEUR_CODE_ANNULATION, codeAnnulationDefini, motifCodeInvalide, normaliserCodeAnnulation,
} from './codeAnnulation';

describe('normaliserCodeAnnulation', () => {
  it('met en majuscules et ignore ce qui vient de la dictée', () => {
    expect(normaliserCodeAnnulation('a1b 2c-3')).toBe('A1B2C3');
  });

  it('s’arrête à six caractères', () => {
    expect(normaliserCodeAnnulation('ABCDEFGH')).toHaveLength(LONGUEUR_CODE_ANNULATION);
  });
});

describe('motifCodeInvalide', () => {
  it('accepte un code de six caractères', () => {
    expect(motifCodeInvalide('A1B2C3')).toBeNull();
    expect(motifCodeInvalide('a1b 2c3')).toBeNull();
  });

  it('refuse un code trop court', () => {
    expect(motifCodeInvalide('A1B2')).toContain('6 caractères');
  });

  // « 000000 » se tape par réflexe : ce n'est pas un code, c'est une porte ouverte.
  it('refuse un code tout en même caractère', () => {
    expect(motifCodeInvalide('000000')).toContain('devine');
    expect(motifCodeInvalide('AAAAAA')).toContain('devine');
  });
});

describe('codeAnnulationDefini', () => {
  it('reconnaît une filiale sans code', () => {
    expect(codeAnnulationDefini(null)).toBe(false);
    expect(codeAnnulationDefini('')).toBe(false);
    expect(codeAnnulationDefini('pbkdf2$300000$sel$hash')).toBe(true);
  });
});
