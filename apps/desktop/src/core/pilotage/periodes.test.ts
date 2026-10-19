import { describe, expect, it } from 'vitest';
import { casesDeLaFenetre, fenetrePilotage, fenetrePrecedente, libelleCase } from './periodes';

// Un jeudi, pour que « 7 jours » et « ce mois » ne tombent pas sur les mêmes bornes.
const JOUR = new Date('2026-10-15T10:30:00Z');

describe('fenetrePilotage', () => {
  it('borne la journée du matin au soir', () => {
    const f = fenetrePilotage('JOUR', JOUR);
    expect(f.jourDebut).toBe('2026-10-15');
    expect(f.jourFin).toBe('2026-10-15');
    expect(f.debut).toBe('2026-10-15T00:00:00.000Z');
    expect(f.fin).toBe('2026-10-15T23:59:59.999Z');
  });

  it('compte sept jours en comptant aujourd’hui', () => {
    const f = fenetrePilotage('SEMAINE', JOUR);
    expect(f.jourDebut).toBe('2026-10-09');
    expect(casesDeLaFenetre(f)).toHaveLength(7);
  });

  it('part du premier du mois', () => {
    expect(fenetrePilotage('MOIS', JOUR).jourDebut).toBe('2026-10-01');
  });

  it('donne douze mois, le mois en cours compris', () => {
    const f = fenetrePilotage('ANNEE', JOUR);
    expect(f.jourDebut).toBe('2025-11-01');
    expect(f.granularite).toBe('MOIS');
    expect(casesDeLaFenetre(f)).toHaveLength(12);
  });

  it('passe au mois dès que la fenêtre dépasse le mois', () => {
    expect(fenetrePilotage('SEMAINE', JOUR).granularite).toBe('JOUR');
    expect(fenetrePilotage('MOIS', JOUR).granularite).toBe('JOUR');
    expect(fenetrePilotage('ANNEE', JOUR).granularite).toBe('MOIS');
  });
});

describe('fenetrePrecedente', () => {
  it('recule d’une durée égale : la veille pour une journée', () => {
    const p = fenetrePrecedente(fenetrePilotage('JOUR', JOUR));
    expect(p.jourDebut).toBe('2026-10-14');
    expect(p.jourFin).toBe('2026-10-14');
  });

  it('recule de sept jours pour une semaine', () => {
    const p = fenetrePrecedente(fenetrePilotage('SEMAINE', JOUR));
    expect(p.jourDebut).toBe('2026-10-02');
    expect(p.jourFin).toBe('2026-10-08');
  });

  it('compare un mois entamé à la même durée, pas au mois entier', () => {
    // Du 1er au 15 : quinze jours. La période d'avant va donc du 16 au 30 septembre.
    const p = fenetrePrecedente(fenetrePilotage('MOIS', JOUR));
    expect(p.jourDebut).toBe('2026-09-16');
    expect(p.jourFin).toBe('2026-09-30');
  });
});

describe('casesDeLaFenetre', () => {
  it('ne laisse aucun trou : un jour sans vente est une case à zéro', () => {
    const cases = casesDeLaFenetre(fenetrePilotage('SEMAINE', JOUR));
    expect(cases[0]).toBe('2026-10-09');
    expect(cases.at(-1)).toBe('2026-10-15');
  });

  it('enjambe un changement d’année en mensuel', () => {
    const cases = casesDeLaFenetre(fenetrePilotage('ANNEE', JOUR));
    expect(cases[0]).toBe('2025-11');
    expect(cases[2]).toBe('2026-01');
    expect(cases.at(-1)).toBe('2026-10');
  });
});

describe('libelleCase', () => {
  it('abrège : sous une barre, il n’y a pas la place', () => {
    expect(libelleCase('2026-10-15', 'JOUR')).toBe('15/10');
    expect(libelleCase('2026-01', 'MOIS')).toBe('janv.');
  });
});
