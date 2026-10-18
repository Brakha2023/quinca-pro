import { describe, expect, it } from 'vitest';
import { perimetreEtatStock, recapEtatStock, type LigneEtatStock } from './etatStock';

const ligne = (over: Partial<LigneEtatStock> = {}): LigneEtatStock => ({
  quantite: 10, cout_moyen: 1000, article_stock_min: 5, article_stock_max: 0, ...over,
});

describe('recapEtatStock', () => {
  it('valorise au coût moyen', () => {
    expect(recapEtatStock([ligne({ quantite: 3, cout_moyen: 2500 }), ligne({ quantite: 2, cout_moyen: 1000 })]).valeur).toBe(9500);
  });

  it('compte ce qui demande une décision', () => {
    const r = recapEtatStock([
      ligne({ quantite: 0 }),
      ligne({ quantite: 5 }),
      ligne({ quantite: 60, article_stock_max: 50 }),
      ligne(),
    ]);
    expect(r).toMatchObject({ lignes: 4, ruptures: 1, faibles: 1, surstocks: 1 });
  });

  it('signale les quantités négatives au lieu de les cacher', () => {
    const r = recapEtatStock([ligne({ quantite: -2, cout_moyen: 1000 })]);
    expect(r.negatifs).toBe(1);
    expect(r.valeur).toBe(-2000);
  });

  it('tient debout sur un stock vide', () => {
    expect(recapEtatStock([])).toEqual({ lignes: 0, valeur: 0, ruptures: 0, faibles: 0, surstocks: 0, negatifs: 0 });
  });
});

describe('perimetreEtatStock', () => {
  it('dit sur quoi porte la liste', () => {
    expect(perimetreEtatStock({})).toBe('tous dépôts');
    expect(perimetreEtatStock({ depotNom: 'Magasin central', recherche: ' cim ', alertesSeulement: true }))
      .toBe('dépôt « Magasin central » · recherche « cim » · lignes en alerte seulement');
  });
});
