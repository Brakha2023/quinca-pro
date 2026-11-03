import { describe, expect, it } from 'vitest';
import {
  alertesMarges, avecParts, filtrerMarges, margesArticles, margesCategories,
  perimetreMarges, recapMarges, tauxMarge, trierMarges, type MargeArticleRow,
} from './marges';

/**
 * Jeu d'essai : deux catégories qui rapportent, une qui vend à perte.
 *
 * Le ciment fait le chiffre et peu de marge, la peinture l'inverse — c'est
 * exactement ce que le rapport doit faire voir, et c'est le piège d'un
 * classement par chiffre d'affaires seul.
 */
const ROWS: MargeArticleRow[] = [
  { cle: 'a1', code: 'CIM-50', designation: 'Ciment 50 kg', unite: 'SAC', famille_cle: 'f1', famille: 'Matériaux', ca_ht: 1_000_000, cout: 900_000, quantite: 200, lignes: 40, sorties_sans_cout: 0 },
  { cle: 'a2', code: 'FER-12', designation: 'Fer à béton 12', unite: 'BARRE', famille_cle: 'f1', famille: 'Matériaux', ca_ht: 500_000, cout: 400_000, quantite: 100, lignes: 20, sorties_sans_cout: 2 },
  { cle: 'a3', code: 'PEI-20', designation: 'Peinture 20 L', unite: 'POT', famille_cle: 'f2', famille: 'Peinture', ca_ht: 500_000, cout: 200_000, quantite: 20, lignes: 10, sorties_sans_cout: 0 },
  // Vendu sous son prix de revient : un solde mal calculé, ou un prix d'achat
  // qui a monté sans que le catalogue suive.
  { cle: 'a4', code: 'VIS-50', designation: 'Vis 50 mm', unite: 'BOITE', famille_cle: 'f3', famille: 'Quincaillerie', ca_ht: 100_000, cout: 130_000, quantite: 50, lignes: 5, sorties_sans_cout: 0 },
];

describe('tauxMarge', () => {
  it('rapporte la marge au chiffre d’affaires, à la dixième', () => {
    expect(tauxMarge(1_000_000, 250_000)).toBe(25);
    expect(tauxMarge(300_000, 100_000)).toBe(33.3);
  });

  it('ne divise pas par un chiffre d’affaires nul', () => {
    expect(tauxMarge(0, -5000)).toBe(0);
  });
});

describe('margesArticles', () => {
  it('déduit la marge et son taux de chaque article', () => {
    const lignes = margesArticles(ROWS);
    expect(lignes[0]).toMatchObject({ code: 'CIM-50', marge: 100_000, taux_marge: 10, articles: 1 });
    expect(lignes[2]).toMatchObject({ code: 'PEI-20', marge: 300_000, taux_marge: 60 });
  });

  it('montre la perte telle quelle, signe compris', () => {
    const vis = margesArticles(ROWS).find((l) => l.code === 'VIS-50')!;
    expect(vis.marge).toBe(-30_000);
    expect(vis.taux_marge).toBe(-30);
  });

  it('range sous « Sans catégorie » un article qui n’en a pas', () => {
    const [ligne] = margesArticles([{ ...ROWS[0]!, famille_cle: null, famille: null }]);
    expect(ligne).toMatchObject({ famille: 'Sans catégorie', famille_cle: 'sans-categorie' });
  });

  it('tient les colonnes nulles d’une ligne sans vente', () => {
    const [ligne] = margesArticles([{
      cle: 'a9', code: null, designation: null, unite: null, famille_cle: null, famille: null,
      ca_ht: null, cout: null, quantite: null, lignes: null, sorties_sans_cout: null,
    }]);
    expect(ligne).toMatchObject({ libelle: 'Article inconnu', ca_ht: 0, marge: 0, taux_marge: 0 });
  });
});

describe('margesCategories', () => {
  it('additionne les articles d’une catégorie et recalcule son taux', () => {
    const categories = margesCategories(margesArticles(ROWS));
    const materiaux = categories.find((c) => c.cle === 'f1')!;
    // 1 500 000 de CA, 1 300 000 de coût : 200 000 de marge, soit 13,3 %.
    expect(materiaux).toMatchObject({ libelle: 'Matériaux', ca_ht: 1_500_000, cout: 1_300_000, marge: 200_000, taux_marge: 13.3, articles: 2, quantite: 300, lignes: 60 });
  });

  it('ne fait pas la moyenne des taux : elle donnerait un chiffre introuvable à la main', () => {
    const materiaux = margesCategories(margesArticles(ROWS)).find((c) => c.cle === 'f1')!;
    // La moyenne de 10 % et 20 % serait 15 % ; le vrai taux est 13,3 %.
    expect(materiaux.taux_marge).not.toBe(15);
  });

  it('garde une catégorie par ligne, sans en inventer', () => {
    expect(margesCategories(margesArticles(ROWS)).map((c) => c.libelle)).toEqual(['Matériaux', 'Peinture', 'Quincaillerie']);
  });

  it('reporte le compte des sorties non valorisées', () => {
    const materiaux = margesCategories(margesArticles(ROWS)).find((c) => c.cle === 'f1')!;
    expect(materiaux.sorties_sans_cout).toBe(2);
  });
});

describe('avecParts', () => {
  it('fait cent sur la sélection affichée', () => {
    const parts = avecParts(margesCategories(margesArticles(ROWS)));
    expect(parts.reduce((t, l) => t + l.part_ca, 0)).toBeCloseTo(100, 1);
    // Matériaux : 1 500 000 sur 2 100 000 de CA, soit 71,4 %.
    expect(parts.find((c) => c.cle === 'f1')!.part_ca).toBe(71.4);
    // Mais seulement 200 000 sur 470 000 de marge : 42,6 %.
    expect(parts.find((c) => c.cle === 'f1')!.part_marge).toBe(42.6);
  });

  it('laisse la part de marge à zéro quand la sélection ne dégage rien', () => {
    const perte = avecParts(margesArticles([ROWS[3]!]));
    expect(perte[0]).toMatchObject({ part_ca: 100, part_marge: 0 });
  });
});

describe('filtrerMarges', () => {
  const lignes = margesArticles(ROWS);

  it('retient une seule catégorie', () => {
    expect(filtrerMarges(lignes, { familleCle: 'f1' }).map((l) => l.code)).toEqual(['CIM-50', 'FER-12']);
  });

  it('cherche dans le code, la désignation et la catégorie', () => {
    expect(filtrerMarges(lignes, { recherche: 'pei' }).map((l) => l.code)).toEqual(['PEI-20']);
    expect(filtrerMarges(lignes, { recherche: 'CIM' }).map((l) => l.code)).toEqual(['CIM-50']);
    expect(filtrerMarges(lignes, { recherche: 'matériaux' }).map((l) => l.code)).toEqual(['CIM-50', 'FER-12']);
  });

  it('croise la catégorie et la recherche', () => {
    expect(filtrerMarges(lignes, { familleCle: 'f1', recherche: 'fer' }).map((l) => l.code)).toEqual(['FER-12']);
  });
});

describe('trierMarges', () => {
  const lignes = margesArticles(ROWS);

  it('classe par marge, du plus fort au plus faible', () => {
    expect(trierMarges(lignes, 'MARGE').map((l) => l.code)).toEqual(['PEI-20', 'CIM-50', 'FER-12', 'VIS-50']);
  });

  it('classe par chiffre d’affaires — où le ciment repasse devant', () => {
    expect(trierMarges(lignes, 'CA').map((l) => l.code)[0]).toBe('CIM-50');
  });

  it('classe par taux, et la peinture domine', () => {
    expect(trierMarges(lignes, 'TAUX').map((l) => l.code)).toEqual(['PEI-20', 'FER-12', 'CIM-50', 'VIS-50']);
  });

  it('classe par quantité vendue', () => {
    expect(trierMarges(lignes, 'QUANTITE').map((l) => l.code)[0]).toBe('CIM-50');
  });

  it('départage à égalité par ordre alphabétique', () => {
    const egales = margesArticles([
      { ...ROWS[0]!, cle: 'x', code: 'ZZZ', designation: 'Zinc', ca_ht: 100, cout: 50 },
      { ...ROWS[0]!, cle: 'y', code: 'AAA', designation: 'Agrafe', ca_ht: 100, cout: 50 },
    ]);
    expect(trierMarges(egales, 'MARGE').map((l) => l.code)).toEqual(['AAA', 'ZZZ']);
  });
});

describe('recapMarges', () => {
  it('totalise la sélection, et recalcule le taux d’ensemble', () => {
    expect(recapMarges(margesArticles(ROWS))).toMatchObject({
      categories: 3, articles: 4, lignes: 75, quantite: 370,
      ca_ht: 2_100_000, cout: 1_630_000, marge: 470_000, taux_marge: 22.4,
      sorties_sans_cout: 2,
    });
  });

  it('vaut zéro sur une sélection vide, sans diviser par rien', () => {
    expect(recapMarges([])).toMatchObject({ categories: 0, articles: 0, ca_ht: 0, marge: 0, taux_marge: 0 });
  });

  it('donne le même total que les catégories qu’il regroupe', () => {
    const articles = margesArticles(ROWS);
    const parCategorie = margesCategories(articles).reduce((t, c) => t + c.marge, 0);
    expect(recapMarges(articles).marge).toBe(parCategorie);
  });
});

describe('alertesMarges', () => {
  it('sort ce qui s’est vendu à perte, le pire d’abord', () => {
    const { aPerte, perte } = alertesMarges(margesArticles(ROWS));
    expect(aPerte.map((l) => l.code)).toEqual(['VIS-50']);
    expect(perte).toBe(-30_000);
  });

  it('ne signale rien quand tout rapporte', () => {
    expect(alertesMarges(margesArticles(ROWS.slice(0, 3))).aPerte).toHaveLength(0);
  });
});

describe('perimetreMarges', () => {
  it('dit la période et les filtres en une phrase', () => {
    expect(perimetreMarges({ debut: '01/11/2026', fin: '03/11/2026' }))
      .toBe('du 01/11/2026 au 03/11/2026 · toutes catégories');
    expect(perimetreMarges({ debut: '01/11/2026', fin: '03/11/2026', categorieLibelle: 'Peinture', recherche: ' pot ' }))
      .toBe('du 01/11/2026 au 03/11/2026 · catégorie « Peinture » · recherche « pot »');
  });
});
