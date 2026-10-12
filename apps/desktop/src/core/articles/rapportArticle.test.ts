import { describe, expect, it } from 'vitest';
import {
  VENTES_VIDES,
  debutPeriode,
  indicateursArticle,
  statutStock,
  totauxStock,
  type StockDepot,
  type VentesArticle,
} from './rapportArticle';

const depot = (over: Partial<StockDepot> = {}): StockDepot => ({
  depot_id: 'd1',
  depot_nom: 'Magasin',
  quantite: 10,
  quantite_reservee: 2,
  quantite_disponible: 8,
  cout_moyen: 1000,
  date_dernier_mouvement: null,
  ...over,
});

const article = { prix_achat: 1000, prix_vente: 1500, prix_vip: null, stock_min: 5, stock_max: 50 };

describe('totauxStock', () => {
  it('cumule les dépôts et valorise au coût moyen de chacun', () => {
    expect(
      totauxStock([
        depot(),
        depot({ depot_id: 'd2', quantite: 5, quantite_reservee: 0, quantite_disponible: 5, cout_moyen: 1200 }),
      ]),
    ).toEqual({ quantite: 15, reservee: 2, disponible: 13, valeur: 16000 });
  });

  it('rend des totaux nuls sans ligne de stock', () => {
    expect(totauxStock([])).toEqual({ quantite: 0, reservee: 0, disponible: 0, valeur: 0 });
  });
});

describe('statutStock', () => {
  it('signale la rupture, y compris sur un stock négatif', () => {
    expect(statutStock(article, 0)).toBe('RUPTURE');
    expect(statutStock(article, -3)).toBe('RUPTURE');
  });

  it('alerte au seuil minimum inclus', () => {
    expect(statutStock(article, 5)).toBe('ALERTE');
    expect(statutStock(article, 6)).toBe('NORMAL');
  });

  it('signale le surstock au-delà du maximum', () => {
    expect(statutStock(article, 51)).toBe('SURSTOCK');
    expect(statutStock(article, 50)).toBe('NORMAL');
  });

  it('ignore les seuils non renseignés', () => {
    expect(statutStock({ stock_min: 0, stock_max: 0 }, 1)).toBe('NORMAL');
  });
});

describe('indicateursArticle', () => {
  const totaux = { quantite: 20, reservee: 0, disponible: 20, valeur: 20000 };
  const ventes: VentesArticle = {
    quantite: 60,
    total_ht: 90000,
    total_ttc: 106200,
    nombre_ventes: 12,
    derniere_date: '2026-10-10T09:00:00.000Z',
    dernier_prix: 1500,
  };

  it('calcule la marge unitaire et la marge potentielle du stock', () => {
    const i = indicateursArticle(article, totaux, ventes, 30);
    expect(i.marge_valeur).toBe(500);
    expect(i.marge_percent).toBe(50);
    expect(i.valeur_achat).toBe(20000);
    expect(i.valeur_vente).toBe(30000);
    expect(i.marge_potentielle).toBe(10000);
  });

  it('calcule le rythme de vente et la couverture du stock', () => {
    const i = indicateursArticle(article, totaux, ventes, 30);
    expect(i.vente_par_jour).toBe(2);
    expect(i.couverture_jours).toBe(10);
    expect(i.rotation).toBe(4.5);
  });

  it('projette la couverture sur le rythme exact, pas sur le rythme arrondi', () => {
    const i = indicateursArticle(article, { quantite: 10, reservee: 0, disponible: 10, valeur: 10000 }, { ...ventes, quantite: 6 }, 90);
    expect(i.vente_par_jour).toBe(0.07);
    expect(i.couverture_jours).toBe(150);
  });

  it('laisse la couverture indéterminée sans vente sur la période', () => {
    const i = indicateursArticle(article, totaux, VENTES_VIDES, 30);
    expect(i.vente_par_jour).toBe(0);
    expect(i.couverture_jours).toBeNull();
    expect(i.rotation).toBe(0);
  });

  it('laisse la rotation indéterminée sans stock valorisé', () => {
    expect(indicateursArticle(article, { quantite: 0, reservee: 0, disponible: 0, valeur: 0 }, ventes, 30).rotation).toBeNull();
  });

  it('rend la marge VIP seulement si le tarif VIP existe', () => {
    expect(indicateursArticle(article, totaux, ventes, 30).marge_vip_percent).toBeNull();
    const vip = indicateursArticle({ ...article, prix_vip: 1200 }, totaux, ventes, 30);
    expect(vip.marge_vip_valeur).toBe(200);
    expect(vip.marge_vip_percent).toBe(20);
  });
});

describe('debutPeriode', () => {
  it('remonte du nombre de jours demandé', () => {
    expect(debutPeriode(30, new Date('2026-10-12T10:00:00.000Z')).slice(0, 10)).toBe('2026-09-12');
  });
});
