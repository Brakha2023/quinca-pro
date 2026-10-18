import { describe, expect, it } from 'vitest';
import { perimetreCatalogue, recapCatalogue } from './catalogue';
import type { Article } from './article';

const article = (over: Partial<Article> = {}): Article => ({
  id: 'a', code: 'A-1', designation: 'Article', famille_id: null, sous_famille: null,
  prix_achat: 1000, prix_vente: 1500, prix_vip: null, tva: 18, stock_min: 0, stock_max: 0,
  unite: 'PIECE', image_url: null, filiale_id: 'f', est_actif: true, ...over,
});

describe('recapCatalogue', () => {
  it('compte ce que la liste contient et ce qu’elle met de côté', () => {
    const r = recapCatalogue([article(), article({ est_actif: false }), article({ prix_achat: 2000, prix_vente: 1800 })]);
    expect(r).toMatchObject({ nombre: 3, actifs: 2, inactifs: 1, a_perte: 1 });
  });

  it('signale les articles sans prix de vente : invendables en l’état', () => {
    expect(recapCatalogue([article({ prix_vente: 0 }), article()]).sans_prix).toBe(1);
  });

  it('ignore les articles sans prix d’achat dans la marge moyenne, au lieu de compter 100 %', () => {
    // 50 % et 25 % ; le troisième n'a pas de prix d'achat et ne doit pas tirer la moyenne.
    const r = recapCatalogue([
      article({ prix_achat: 1000, prix_vente: 1500 }),
      article({ prix_achat: 1000, prix_vente: 1250 }),
      article({ prix_achat: 0, prix_vente: 900 }),
    ]);
    expect(r.marge_moyenne).toBe(37.5);
  });

  it('ne divise pas par zéro sur un catalogue vide', () => {
    expect(recapCatalogue([])).toEqual({ nombre: 0, actifs: 0, inactifs: 0, marge_moyenne: 0, a_perte: 0, sans_prix: 0 });
  });
});

describe('perimetreCatalogue', () => {
  it('dit ce que la liste imprimée contient vraiment', () => {
    expect(perimetreCatalogue({})).toBe('toutes familles · articles actifs seulement');
    expect(perimetreCatalogue({ familleNom: 'CARREAU', recherche: ' 250 ', inclureInactifs: true }))
      .toBe('famille « CARREAU » · recherche « 250 » · articles inactifs compris');
  });
});
