import { describe, expect, it } from 'vitest';
import {
  JOURS_AVANT_DORMANT, classerStock, dormantsLesPlusLourds, repartitionStock, type LigneStockPilotage,
} from './stock';

const MAINTENANT = new Date('2026-10-15T12:00:00Z');
const ilYA = (jours: number) => new Date(MAINTENANT.getTime() - jours * 86_400_000).toISOString();

const ligne = (p: Partial<LigneStockPilotage> = {}): LigneStockPilotage => ({
  article_id: 'a1', code: 'CIM-50', designation: 'Ciment 50 kg',
  quantite: 100, stock_min: 20, valeur: 450_000, dernier_mouvement: ilYA(2), ...p,
});

describe('classerStock', () => {
  it('appelle rupture ce qu’on ne peut plus servir', () => {
    expect(classerStock(ligne({ quantite: 0 }), MAINTENANT)).toBe('RUPTURE');
    expect(classerStock(ligne({ quantite: -5 }), MAINTENANT)).toBe('RUPTURE');
  });

  it('appelle dormant ce qui n’a pas bougé depuis un trimestre', () => {
    expect(classerStock(ligne({ dernier_mouvement: ilYA(JOURS_AVANT_DORMANT + 1) }), MAINTENANT)).toBe('DORMANT');
    expect(classerStock(ligne({ dernier_mouvement: ilYA(JOURS_AVANT_DORMANT - 1) }), MAINTENANT)).toBe('ACTIF');
  });

  it('tient pour dormant un article qui n’a jamais bougé', () => {
    expect(classerStock(ligne({ dernier_mouvement: null }), MAINTENANT)).toBe('DORMANT');
  });

  it('signale ce qu’il faut recommander', () => {
    expect(classerStock(ligne({ quantite: 15, stock_min: 20 }), MAINTENANT)).toBe('SOUS_MINIMUM');
    expect(classerStock(ligne({ quantite: 20, stock_min: 20 }), MAINTENANT)).toBe('SOUS_MINIMUM');
  });

  it('ne réclame rien d’un article sans minimum fixé', () => {
    expect(classerStock(ligne({ quantite: 1, stock_min: 0 }), MAINTENANT)).toBe('ACTIF');
  });

  it('laisse dormant ce qui dort sous son minimum : le recommander serait l’erreur', () => {
    expect(classerStock(ligne({ quantite: 5, stock_min: 20, dernier_mouvement: ilYA(200) }), MAINTENANT)).toBe('DORMANT');
  });

  it('fait passer la rupture avant tout le reste', () => {
    expect(classerStock(ligne({ quantite: 0, stock_min: 20, dernier_mouvement: ilYA(300) }), MAINTENANT)).toBe('RUPTURE');
  });
});

describe('repartitionStock', () => {
  const lignes = [
    ligne({ article_id: '1' }),
    ligne({ article_id: '2', quantite: 0, valeur: 0 }),
    ligne({ article_id: '3', dernier_mouvement: ilYA(120), valeur: 300_000 }),
    ligne({ article_id: '4', quantite: 10, stock_min: 20, valeur: 50_000 }),
  ];

  it('garde les quatre états, même ceux restés vides', () => {
    expect(repartitionStock([], MAINTENANT).parts.map((p) => p.etat))
      .toEqual(['RUPTURE', 'DORMANT', 'SOUS_MINIMUM', 'ACTIF']);
  });

  it('range chaque article dans un seul état', () => {
    const r = repartitionStock(lignes, MAINTENANT);
    expect(r.articles).toBe(4);
    expect(r.parts.reduce((t, p) => t + p.articles, 0)).toBe(4);
  });

  it('chiffre la valeur qui dort : c’est elle qui intéresse le gérant', () => {
    expect(repartitionStock(lignes, MAINTENANT).valeur_dormante).toBe(300_000);
  });

  it('calcule des parts qui font cent', () => {
    const r = repartitionStock(lignes, MAINTENANT);
    expect(r.valeur).toBe(800_000);
    expect(Math.round(r.parts.reduce((t, p) => t + p.part, 0))).toBe(100);
  });

  it('ne compte pas un stock négatif comme une valeur négative', () => {
    const r = repartitionStock([ligne({ quantite: -3, valeur: -13_560 })], MAINTENANT);
    expect(r.valeur).toBe(0);
    expect(r.ruptures).toBe(1);
  });

  it('ne divise pas par zéro sur un stock vide', () => {
    expect(repartitionStock([], MAINTENANT).parts.every((p) => p.part === 0)).toBe(true);
  });
});

describe('dormantsLesPlusLourds', () => {
  it('classe par valeur : par où commencer à déstocker', () => {
    const lignes = [
      ligne({ article_id: '1', dernier_mouvement: ilYA(200), valeur: 100_000 }),
      ligne({ article_id: '2', dernier_mouvement: ilYA(200), valeur: 900_000 }),
      ligne({ article_id: '3', valeur: 5_000_000 }),
    ];
    expect(dormantsLesPlusLourds(lignes, 5, MAINTENANT).map((l) => l.article_id)).toEqual(['2', '1']);
  });

  it('s’arrête à la limite demandée', () => {
    const lignes = Array.from({ length: 10 }, (_, i) => ligne({ article_id: `${i}`, dernier_mouvement: ilYA(200), valeur: i * 1000 }));
    expect(dormantsLesPlusLourds(lignes, 3, MAINTENANT)).toHaveLength(3);
  });
});
