import { describe, expect, it } from 'vitest';
import { joursDepuis, repartirParAnciennete, trancheDe, type FactureImpayee } from './creances';

const MAINTENANT = new Date('2026-10-15T12:00:00Z');
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const facture = (p: Partial<FactureImpayee> = {}): FactureImpayee => ({
  id: 'v1', numero: 'VTE-001', client: 'SOCIMAT CI', date: ilYA(10), reste: 100_000, ...p,
});

describe('joursDepuis', () => {
  it('compte les jours écoulés', () => {
    expect(joursDepuis(ilYA(30), MAINTENANT)).toBe(30);
  });

  it('ne rend pas d’âge négatif pour une date à venir', () => {
    expect(joursDepuis(new Date(MAINTENANT.getTime() + 86_400_000).toISOString(), MAINTENANT)).toBe(0);
  });
});

describe('trancheDe', () => {
  it('range chaque facture dans sa tranche', () => {
    expect(trancheDe(ilYA(0), MAINTENANT)).toBe('0-30');
    expect(trancheDe(ilYA(30), MAINTENANT)).toBe('0-30');
    expect(trancheDe(ilYA(31), MAINTENANT)).toBe('31-60');
    expect(trancheDe(ilYA(60), MAINTENANT)).toBe('31-60');
    expect(trancheDe(ilYA(61), MAINTENANT)).toBe('61-90');
    expect(trancheDe(ilYA(91), MAINTENANT)).toBe('90+');
  });

  it('met tout ce qui est très vieux dans la dernière tranche', () => {
    expect(trancheDe(ilYA(900), MAINTENANT)).toBe('90+');
  });
});

describe('repartirParAnciennete', () => {
  const factures = [
    facture({ id: '1', date: ilYA(5), reste: 100_000 }),
    facture({ id: '2', date: ilYA(45), reste: 200_000 }),
    facture({ id: '3', date: ilYA(120), reste: 300_000 }),
    facture({ id: '4', date: ilYA(400), reste: 150_000 }),
  ];

  it('garde les quatre tranches, même vides', () => {
    expect(repartirParAnciennete([], MAINTENANT).parts.map((p) => p.tranche))
      .toEqual(['0-30', '31-60', '61-90', '90+']);
  });

  it('additionne par tranche', () => {
    const r = repartirParAnciennete(factures, MAINTENANT);
    expect(r.total).toBe(750_000);
    expect(r.factures).toBe(4);
    expect(r.parts.find((p) => p.tranche === '90+')).toMatchObject({ montant: 450_000, factures: 2 });
  });

  it('isole ce qui ne rentrera pas tout seul', () => {
    expect(repartirParAnciennete(factures, MAINTENANT).au_dela_de_90).toBe(450_000);
  });

  it('ignore une facture soldée', () => {
    const r = repartirParAnciennete([facture({ reste: 0 }), facture({ id: '2', reste: -500 })], MAINTENANT);
    expect(r.total).toBe(0);
    expect(r.factures).toBe(0);
  });

  it('calcule des parts qui font cent', () => {
    const r = repartirParAnciennete(factures, MAINTENANT);
    expect(Math.round(r.parts.reduce((t, p) => t + p.part, 0))).toBe(100);
  });
});
