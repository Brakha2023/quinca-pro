import { describe, expect, it } from 'vitest';
import { productionSchema, repartirCoutProduction } from './production';

describe('repartirCoutProduction', () => {
  it('répartit au prorata de la valeur quand tous les produits ont un prix d’achat', () => {
    const couts = repartirCoutProduction(10000, [
      { article_id: 'a', quantite: 10, prix_achat: 300 }, // valeur 3000
      { article_id: 'b', quantite: 5, prix_achat: 1400 }, // valeur 7000
    ]);
    expect(couts.get('a')).toBe(300); // 3000 / 10
    expect(couts.get('b')).toBe(1400); // 7000 / 5
  });

  it('répartit au prorata des quantités sinon, et les pertes renchérissent les unités bonnes', () => {
    const couts = repartirCoutProduction(9000, [
      { article_id: 'a', quantite: 6, prix_achat: 0 },
      { article_id: 'b', quantite: 3, prix_achat: 500 },
    ]);
    expect(couts.get('a')).toBe(1000);
    expect(couts.get('b')).toBe(1000);
    // Tout perdu sur b : a supporte la totalité.
    const seul = repartirCoutProduction(9000, [{ article_id: 'a', quantite: 6, prix_achat: 0 }, { article_id: 'b', quantite: 0, prix_achat: 0 }]);
    expect(seul.get('a')).toBe(1500);
    expect(seul.has('b')).toBe(false);
  });
});

describe('productionSchema', () => {
  const base = { depot_id: 'd', date_debut: '2026-09-18T08:00', matieres: [{ article_id: 'm', quantite: 2 }], produits: [{ article_id: 'p', quantite: 4 }] };

  it('exige matières, produits et une quantité produite', () => {
    expect(productionSchema.safeParse(base).success).toBe(true);
    expect(productionSchema.safeParse({ ...base, matieres: [] }).success).toBe(false);
    expect(productionSchema.safeParse({ ...base, produits: [{ article_id: 'p', quantite: 0 }] }).success).toBe(false);
  });

  it('refuse un article à la fois matière et produit, et une fin avant le début', () => {
    expect(productionSchema.safeParse({ ...base, produits: [{ article_id: 'm', quantite: 1 }] }).success).toBe(false);
    expect(productionSchema.safeParse({ ...base, date_fin: '2026-09-18T07:00' }).success).toBe(false);
  });
});
