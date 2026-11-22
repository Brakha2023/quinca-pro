import { describe, expect, it } from 'vitest';
import { bonPorteUnPoids, formaterTonnage, poidsLigne, tonnageBon, tonnagePartiel } from './poids';

const ligne = (poids: number | null, quantite: number) => ({ article: { poids_tonnes: poids }, quantite });

/** Le cas de la maison : un sac de ciment pèse 50 kg, soit 0,05 t. */
const SAC_CIMENT = 0.05;

describe('poidsLigne', () => {
  it('pèse la ligne au poids unitaire de l’article', () => {
    expect(poidsLigne(ligne(SAC_CIMENT, 400))).toBe(20); // un camion de 20 t
    expect(poidsLigne(ligne(SAC_CIMENT, 1))).toBe(0.05);
  });

  /*
   * `null` n'est pas zéro : on ignore ce que pèse cet article, on n'affirme
   * pas qu'il ne pèse rien. Annoncer « 0 t » au transporteur serait un
   * mensonge, un tiret est la vérité.
   */
  it('rend null pour un article sans poids, jamais zéro', () => {
    expect(poidsLigne(ligne(null, 10))).toBeNull();
  });

  it('ne traîne pas les flottants', () => {
    expect(poidsLigne(ligne(0.1, 3))).toBe(0.3); // et non 0.30000000000000004
  });
});

describe('bonPorteUnPoids', () => {
  // C'est ce booléen qui fait apparaître la colonne « Poids » sur les bons.
  it('est vrai dès qu’un seul article est pesé', () => {
    expect(bonPorteUnPoids([ligne(null, 5), ligne(SAC_CIMENT, 10)])).toBe(true);
  });

  it('est faux quand aucun ne l’est — la colonne reste invisible', () => {
    expect(bonPorteUnPoids([ligne(null, 5), ligne(null, 2)])).toBe(false);
    expect(bonPorteUnPoids([])).toBe(false);
  });

  // Un article qui pèse vraiment zéro reste un article pesé.
  it('compte un poids nul comme renseigné', () => {
    expect(bonPorteUnPoids([ligne(0, 5)])).toBe(true);
  });
});

describe('tonnageBon', () => {
  it('additionne les lignes pesées', () => {
    expect(tonnageBon([ligne(SAC_CIMENT, 400), ligne(2.5, 4)])).toBe(30);
  });

  it('laisse les lignes non pesées en dehors du total', () => {
    expect(tonnageBon([ligne(SAC_CIMENT, 20), ligne(null, 1000)])).toBe(1);
  });
});

/*
 * Le total d'un bon à moitié renseigné est **partiel** : le dire est tout
 * l'intérêt de distinguer `null` de zéro, sinon on charge un camion sur un
 * chiffre amputé.
 */
describe('tonnagePartiel', () => {
  it('prévient quand une partie des lignes seulement est pesée', () => {
    expect(tonnagePartiel([ligne(SAC_CIMENT, 20), ligne(null, 3)])).toBe(true);
  });

  it('se tait quand tout est pesé, ou que rien ne l’est', () => {
    expect(tonnagePartiel([ligne(SAC_CIMENT, 20), ligne(1, 1)])).toBe(false);
    expect(tonnagePartiel([ligne(null, 20)])).toBe(false);
  });
});

describe('formaterTonnage', () => {
  it('n’écrit les décimales que si elles existent', () => {
    expect(formaterTonnage(20)).toBe('20 t');
    expect(formaterTonnage(1.25)).toBe('1,25 t');
    expect(formaterTonnage(0.05)).toBe('0,05 t');
  });

  it('écrit un tiret pour ce qui n’est pas pesé', () => {
    expect(formaterTonnage(null)).toBe('—');
  });
});
