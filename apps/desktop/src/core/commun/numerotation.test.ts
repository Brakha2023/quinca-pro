import { describe, expect, it } from 'vitest';
import {
  LONGUEUR_CODE_POSTE,
  codePosteValide,
  genererCodePoste,
  genererCodeTiers,
  genererNumeroPiece,
  formaterNumeroCourt,
} from './numerotation';

const ALPHABET_ATTENDU = /^[A-HJ-NP-Z2-9]+$/;

describe('genererNumeroPiece', () => {
  it('compose préfixe, poste, jour et suffixe de 6 caractères', () => {
    const n = genererNumeroPiece({ prefixe: 'ENT', poste: 'K7Q', date: new Date('2026-09-22T10:00:00Z') });
    expect(n).toMatch(/^ENT-K7Q-20260922-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('cloisonne les tirages par poste', () => {
    const a = genererNumeroPiece({ prefixe: 'ENT', poste: 'K7Q' });
    const b = genererNumeroPiece({ prefixe: 'ENT', poste: 'M3P' });
    expect(a.split('-')[1]).toBe('K7Q');
    expect(b.split('-')[1]).toBe('M3P');
  });

  it('tire un code de poste plutôt que de perdre la pièce quand il est absent', () => {
    for (const poste of ['', '   ', 'K7', 'k7q!', null as unknown as string]) {
      expect(genererNumeroPiece({ prefixe: 'REG', poste })).toMatch(/^REG-[A-HJ-NP-Z2-9]{3}-\d{8}-[A-HJ-NP-Z2-9]{6}$/);
    }
  });

  it('ne tire pas deux fois le même numéro', () => {
    const tirages = new Set(Array.from({ length: 5000 }, () => genererNumeroPiece({ prefixe: 'ENT', poste: 'K7Q' })));
    expect(tirages.size).toBe(5000);
  });
});

describe('codePoste', () => {
  it('génère un code de la longueur attendue, dans l’alphabet sans ambiguïté', () => {
    const code = genererCodePoste();
    expect(code).toHaveLength(LONGUEUR_CODE_POSTE);
    expect(code).toMatch(ALPHABET_ATTENDU);
  });

  it('accepte un code relu, normalisé en majuscules', () => {
    expect(codePosteValide('k7q')).toBe('K7Q');
    expect(codePosteValide(' K7Q ')).toBe('K7Q');
  });

  it('refuse un code absent, trop court ou hors alphabet', () => {
    for (const valeur of [null, undefined, 42, '', 'K7', 'K7QQ', 'K7O', 'K7-']) {
      expect(codePosteValide(valeur)).toBeNull();
    }
  });
});

describe('genererCodeTiers', () => {
  it('compose préfixe et suffixe de 6 caractères', () => {
    expect(genererCodeTiers('CLI')).toMatch(/^CLI-[A-HJ-NP-Z2-9]{6}$/);
  });
});

describe('formaterNumeroCourt', () => {
  it('compose préfixe, poste et compteur sur six chiffres', () => {
    expect(formaterNumeroCourt({ prefixe: 'VNT', poste: 'AN8', sequence: 75 })).toBe('VNT-AN8-000075');
  });

  it('normalise le code du poste comme le numéro long', () => {
    expect(formaterNumeroCourt({ prefixe: 'ENT', poste: ' k7q ', sequence: 1 })).toBe('ENT-K7Q-000001');
  });

  it('tire un code de poste plutôt que de numéroter avec un code altéré', () => {
    const numero = formaterNumeroCourt({ prefixe: 'ENT', poste: 'pas un code', sequence: 3 });
    expect(numero).toMatch(/^ENT-[A-HJ-NP-Z2-9]{3}-000003$/);
  });

  it('déborde des six chiffres plutôt que de recommencer à zéro', () => {
    expect(formaterNumeroCourt({ prefixe: 'VNT', poste: 'AN8', sequence: 1234567 })).toBe('VNT-AN8-1234567');
  });

  it('ne descend jamais en dessous de 1 : il n’existe pas de pièce numéro zéro', () => {
    expect(formaterNumeroCourt({ prefixe: 'VNT', poste: 'AN8', sequence: 0 })).toBe('VNT-AN8-000001');
  });
});
