import { describe, expect, it } from 'vitest';
import { perimetreEtatStock, recapEtatStock, valeurAchat, valeurVente, type LigneEtatStock } from './etatStock';

const ligne = (over: Partial<LigneEtatStock> = {}): LigneEtatStock => ({
  quantite: 10, cout_moyen: 1000, article_prix_vente: 1500, article_stock_min: 5, article_stock_max: 0, ...over,
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

  it('valorise aussi au prix de vente, et chiffre la marge potentielle', () => {
    // 3 sacs payés 2 500 et vendus 4 000 : 7 500 immobilisés, 12 000 à encaisser.
    const r = recapEtatStock([ligne({ quantite: 3, cout_moyen: 2500, article_prix_vente: 4000 })]);
    expect(r).toMatchObject({ valeur: 7500, valeur_vente: 12_000, marge: 4500, marge_percent: 38 });
  });

  it('ne promet rien sur un article sans prix de vente', () => {
    const r = recapEtatStock([ligne({ quantite: 4, cout_moyen: 1000, article_prix_vente: null })]);
    expect(r).toMatchObject({ valeur: 4000, valeur_vente: 0, marge: -4000, marge_percent: 0 });
  });

  it('tient debout sur un stock vide', () => {
    expect(recapEtatStock([])).toEqual({ lignes: 0, valeur: 0, valeur_vente: 0, marge: 0, marge_percent: 0, ruptures: 0, faibles: 0, surstocks: 0, negatifs: 0 });
  });
});

describe('valeurAchat / valeurVente', () => {
  it('chiffrent la même ligne de deux façons', () => {
    const l = ligne({ quantite: 7, cout_moyen: 1200, article_prix_vente: 1800 });
    expect(valeurAchat(l)).toBe(8400);
    expect(valeurVente(l)).toBe(12_600);
  });

  it('comptent zéro plutôt que NaN quand une colonne manque', () => {
    expect(valeurAchat({ quantite: null, cout_moyen: null, article_stock_min: 0, article_stock_max: 0 })).toBe(0);
    expect(valeurVente({ quantite: 5, cout_moyen: 0, article_stock_min: 0, article_stock_max: 0 })).toBe(0);
  });
});

describe('perimetreEtatStock', () => {
  it('dit sur quoi porte la liste', () => {
    expect(perimetreEtatStock({})).toBe('tous dépôts');
    expect(perimetreEtatStock({ depotNom: 'Magasin central', recherche: ' cim ', alertesSeulement: true }))
      .toBe('dépôt « Magasin central » · recherche « cim » · lignes en alerte seulement');
  });
});
