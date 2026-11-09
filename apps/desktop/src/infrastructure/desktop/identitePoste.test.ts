import { beforeEach, describe, expect, it } from 'vitest';
import { codePoste, numeroCourt, numeroPiece } from './identitePoste';

const CLE = 'quinca-poste';
const CLE_HERITEE = 'quinca-code-poste';

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

/** Identité telle qu'elle est rangée sur la machine. */
const retenue = () => JSON.parse(globalThis.localStorage.getItem(CLE) ?? 'null');

describe('codePoste', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fauxStockage();
  });

  it('génère un code à la première lecture et le mémorise sur la machine', () => {
    const code = codePoste();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}$/);
    expect(retenue()).toEqual({ code, sequences: {} });
    expect(codePoste()).toBe(code);
  });

  it('reprend le code déjà mémorisé', () => {
    globalThis.localStorage.setItem(CLE, JSON.stringify({ code: 'K7Q', sequences: {} }));
    expect(codePoste()).toBe('K7Q');
    expect(numeroPiece('ENT', new Date('2026-09-22T10:00:00Z'))).toMatch(/^ENT-K7Q-20260922-[A-HJ-NP-Z2-9]{6}$/);
  });

  it('reprend le code d’un poste d’avant les numéros courts', () => {
    globalThis.localStorage.setItem(CLE_HERITEE, 'K7Q');
    expect(codePoste()).toBe('K7Q');
    expect(numeroCourt('VNT')).toBe('VNT-K7Q-000001');
  });

  it('remplace un code altéré au lieu de numéroter avec', () => {
    globalThis.localStorage.setItem(CLE, JSON.stringify({ code: 'pas un code', sequences: { VNT: 12 } }));
    const code = codePoste();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{3}$/);
    expect(retenue().code).toBe(code);
  });

  it('numérote quand même sans stockage local, et sans changer de code', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    const a = numeroPiece('REG');
    const b = numeroPiece('REG');
    expect(a.split('-')[1]).toBe(b.split('-')[1]);
    expect(a).not.toBe(b);
  });
});

describe('numeroCourt', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fauxStockage();
  });

  it('compte à partir de 1, une série par nature de pièce', () => {
    globalThis.localStorage.setItem(CLE, JSON.stringify({ code: 'K7Q', sequences: {} }));
    expect(numeroCourt('VNT')).toBe('VNT-K7Q-000001');
    expect(numeroCourt('VNT')).toBe('VNT-K7Q-000002');
    // Le bon d'entrée a son propre compteur : la vente ne le fait pas avancer.
    expect(numeroCourt('ENT')).toBe('ENT-K7Q-000001');
    expect(numeroCourt('VNT')).toBe('VNT-K7Q-000003');
  });

  it('mémorise le compteur aussitôt : un numéro rendu est un numéro consommé', () => {
    globalThis.localStorage.setItem(CLE, JSON.stringify({ code: 'K7Q', sequences: {} }));
    numeroCourt('VNT');
    expect(retenue()).toEqual({ code: 'K7Q', sequences: { VNT: 1 } });
  });

  it('reprend la série là où la machine l’avait laissée', () => {
    globalThis.localStorage.setItem(CLE, JSON.stringify({ code: 'K7Q', sequences: { VNT: 74 } }));
    expect(numeroCourt('VNT')).toBe('VNT-K7Q-000075');
  });

  it('garde le code quand les compteurs sont illisibles, et repart à 1', () => {
    globalThis.localStorage.setItem(CLE, JSON.stringify({ code: 'K7Q', sequences: 'abîmé' }));
    expect(numeroCourt('VNT')).toBe('VNT-K7Q-000001');
  });

  it('numérote sans stockage local, et le compteur tient la session', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    const a = numeroCourt('VNT');
    const b = numeroCourt('VNT');
    expect(a.split('-')[1]).toBe(b.split('-')[1]);
    expect(Number(b.split('-')[2])).toBe(Number(a.split('-')[2]) + 1);
  });
});
