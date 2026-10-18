import { describe, expect, it } from 'vitest';
import { differenceAudit, valeursAudit } from './audit';

describe('valeursAudit', () => {
  it('accepte l’objet rendu par le serveur comme le texte rendu par SQLite', () => {
    expect(valeursAudit({ prix_vente: 5900 })).toEqual({ prix_vente: 5900 });
    expect(valeursAudit('{"prix_vente":5900}')).toEqual({ prix_vente: 5900 });
  });

  it('ne casse pas sur du vide ou de l’illisible', () => {
    for (const brut of [null, undefined, '', 'pas du json', '[1,2]', 42]) {
      expect(valeursAudit(brut)).toEqual({});
    }
  });
});

describe('differenceAudit', () => {
  it('ne retient que ce qui a changé, sans l’horodatage technique', () => {
    const avant = { prix_vente: 5900, designation: 'Ciment', updated_at: '2026-10-01T08:00:00Z' };
    const apres = { prix_vente: 6200, designation: 'Ciment', updated_at: '2026-10-02T08:00:00Z' };
    expect(differenceAudit(avant, apres)).toEqual([['prix_vente', 5900, 6200]]);
  });

  it('voit l’apparition et la disparition d’un champ', () => {
    expect(differenceAudit({ a: 1 }, { a: 1, b: 2 })).toEqual([['b', undefined, 2]]);
    expect(differenceAudit({ a: 1, b: 2 }, { a: 1 })).toEqual([['b', 2, undefined]]);
  });

  it('liste tout le contenu d’une création', () => {
    expect(differenceAudit(null, { code: 'CIM-50' })).toEqual([['code', undefined, 'CIM-50']]);
  });
});
