import { describe, expect, it } from 'vitest';
import { MOIS_HISTORIQUE_LOCAL, debutHistoriqueLocal, libelleHistoriqueLocal } from './historique';

describe('debutHistoriqueLocal', () => {
  it('remonte de douze mois et se cale sur le premier du mois', () => {
    expect(debutHistoriqueLocal(new Date('2026-10-18T14:32:11.000Z'))).toBe('2025-10-01T00:00:00.000Z');
  });

  it('ne bouge pas d’un jour à l’autre du même mois : le serveur ne refait pas ses paquets', () => {
    const debut = debutHistoriqueLocal(new Date('2026-10-01T00:00:00.000Z'));
    for (const jour of ['2026-10-02', '2026-10-15', '2026-10-31']) {
      expect(debutHistoriqueLocal(new Date(`${jour}T23:59:59.000Z`))).toBe(debut);
    }
    expect(debutHistoriqueLocal(new Date('2026-11-01T00:00:00.000Z'))).not.toBe(debut);
  });

  it('passe l’année sans se tromper', () => {
    expect(debutHistoriqueLocal(new Date('2026-02-03T08:00:00.000Z'))).toBe('2025-02-01T00:00:00.000Z');
    expect(debutHistoriqueLocal(new Date('2026-01-31T08:00:00.000Z'), 1)).toBe('2025-12-01T00:00:00.000Z');
    expect(debutHistoriqueLocal(new Date('2026-03-31T08:00:00.000Z'), 1)).toBe('2026-02-01T00:00:00.000Z');
  });

  it('garde douze mois par défaut', () => {
    expect(MOIS_HISTORIQUE_LOCAL).toBe(12);
  });
});

describe('libelleHistoriqueLocal', () => {
  it('se lit comme une phrase', () => {
    expect(libelleHistoriqueLocal('2025-11-01T00:00:00.000Z')).toBe('depuis novembre 2025');
    expect(libelleHistoriqueLocal('2026-08-01T00:00:00.000Z')).toBe('depuis août 2026');
  });
});
