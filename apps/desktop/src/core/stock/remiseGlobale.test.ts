import { describe, expect, it } from 'vitest';
import { repartirRemiseGlobale, totalBrutBon, totalNetBon } from './remiseGlobale';

const l = (quantite: number, cout_unitaire: number | '') => ({ quantite, cout_unitaire });

describe('totalBrutBon / totalNetBon', () => {
  it('somme les lignes valorisées et déduit la remise', () => {
    const lignes = [l(10, 4500), l(5, 2000)];
    expect(totalBrutBon(lignes)).toBe(55_000);
    expect(totalNetBon(lignes, 5000)).toBe(50_000);
  });

  it('ignore une ligne sans coût saisi, et ne descend jamais sous zéro', () => {
    expect(totalBrutBon([l(10, 4500), l(3, '')])).toBe(45_000);
    expect(totalNetBon([l(1, 1000)], 5000)).toBe(0);
  });
});

describe('repartirRemiseGlobale', () => {
  it('répartit la remise au prorata de la valeur des lignes', () => {
    const parts = repartirRemiseGlobale([l(10, 4500), l(5, 2000)], 5500);
    // 45 000 et 10 000 sur 55 000 : neuf dixièmes contre un dixième.
    expect(parts.map((p) => p.remise)).toEqual([4500, 1000]);
    expect(parts.map((p) => p.cout_unitaire_net)).toEqual([4050, 1800]);
  });

  it('rend exactement la remise accordée, même quand elle ne se divise pas', () => {
    const parts = repartirRemiseGlobale([l(1, 1000), l(1, 1000), l(1, 1000)], 100);
    expect(parts.reduce((s, p) => s + p.remise, 0)).toBe(100);
    // Le franc en trop va à la ligne la plus lourde — ici la première à égalité.
    expect(parts.map((p) => p.remise)).toEqual([34, 33, 33]);
  });

  it('ne fait rien porter à une ligne sans coût : son coût resterait inconnu', () => {
    const parts = repartirRemiseGlobale([l(10, 4500), l(2, '')], 4500);
    expect(parts[0]?.remise).toBe(4500);
    expect(parts[1]).toMatchObject({ remise: 0, cout_unitaire_net: null });
  });

  it('laisse les coûts intacts sans remise, et refuse une remise illisible', () => {
    expect(repartirRemiseGlobale([l(10, 4500)], 0)).toEqual([{ ligne: l(10, 4500), brut: 45_000, remise: 0, cout_unitaire_net: 4500 }]);
    expect(repartirRemiseGlobale([l(10, 4500)], Number.NaN)[0]?.remise).toBe(0);
    expect(repartirRemiseGlobale([l(10, 4500)], -500)[0]?.remise).toBe(0);
  });

  it('borne la remise au brut : un coût d’achat négatif fausserait le coût moyen pour longtemps', () => {
    const parts = repartirRemiseGlobale([l(10, 4500)], 60_000);
    expect(parts[0]).toMatchObject({ remise: 45_000, cout_unitaire_net: 0 });
  });

  it('ne touche à rien quand le bon n’a aucun coût', () => {
    expect(repartirRemiseGlobale([l(5, ''), l(2, '')], 1000).every((p) => p.remise === 0)).toBe(true);
  });
});
