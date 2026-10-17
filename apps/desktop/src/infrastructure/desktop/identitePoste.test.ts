import { beforeEach, describe, expect, it } from 'vitest';
import { codePoste, numeroPiece } from './identitePoste';

const CLE = 'quinca-code-poste';

function fauxStockage(): Storage {
  const valeurs = new Map<string, string>();
  return {
    getItem: (k: string) => valeurs.get(k) ?? null,
    setItem: (k: string, v: string) => void valeurs.set(k, v),
    removeItem: (k: string) => void valeurs.delete(k),
    clear: () => valeurs.clear(),
    key: () => null,
    get length() {
      return valeurs.size;
    },
  } as Storage;
}

describe('codePoste', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fauxStockage();
  });

  it('génère un code à la première lecture et le mémorise sur la machine', () => {
    const code = codePoste();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}$/);
    expect(globalThis.localStorage.getItem(CLE)).toBe(code);
    expect(codePoste()).toBe(code);
  });

  it('reprend le code déjà mémorisé', () => {
    globalThis.localStorage.setItem(CLE, 'K7Q');
    expect(codePoste()).toBe('K7Q');
    expect(numeroPiece('ENT', new Date('2026-09-22T10:00:00Z'))).toMatch(/^ENT-K7Q-20260922-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('remplace un code altéré au lieu de numéroter avec', () => {
    globalThis.localStorage.setItem(CLE, 'pas un code');
    const code = codePoste();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}$/);
    expect(globalThis.localStorage.getItem(CLE)).toBe(code);
  });

  it('numérote quand même sans stockage local, et sans changer de code', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    const a = numeroPiece('REG');
    const b = numeroPiece('REG');
    expect(a.split('-')[1]).toBe(b.split('-')[1]);
    expect(a).not.toBe(b);
  });
});
