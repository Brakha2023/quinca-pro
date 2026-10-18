import { describe, expect, it } from 'vitest';
import { MOIS_HISTORIQUE_LOCAL, libelleHistoriqueLocal } from './historique';

describe('historique local', () => {
  it('garde douze mois, comme la fonction Postgres qui marque les lignes', () => {
    expect(MOIS_HISTORIQUE_LOCAL).toBe(12);
  });

  it('se lit comme une phrase', () => {
    expect(libelleHistoriqueLocal()).toBe('des 12 derniers mois');
    expect(libelleHistoriqueLocal(18)).toBe('des 18 derniers mois');
  });
});
