import { describe, expect, it } from 'vitest';
import {
  EntetesIntrouvablesError,
  lignesDepuisGrille,
  nombreImport,
  normaliserEntete,
  trouverEntete,
  type Cellule,
} from './importArticles';

/** Extrait réel d'un export ETAT_LISTEARTICLE : un titre, les entêtes, puis les articles. */
const EXPORT_HISTORIQUE: Cellule[][] = [
  ['CATALOGUE ARTICLE [ Revente (Produits finis) ]', null, null, null, null],
  ['CODE', 'DESIGNATION', 'P. ACHAT', 'P. VENTE', 'FAMILLE'],
  ['01408202625001', '250001 METRE CARREAU 25/40', 2166, 2500, 'CARREAU'],
  ['ABAT3', 'ABATANT WC INDUSTRAP', 1080, 1100, 'PLOMBERIE'],
  ['AMP1', 'AMPOULE 0.60', 500, 600, 'ELECTRICITE'],
];

describe('normaliserEntete', () => {
  it('réduit la ponctuation et les accents', () => {
    expect(normaliserEntete('P. ACHAT')).toBe('P ACHAT');
    expect(normaliserEntete('  Désignation ')).toBe('DESIGNATION');
    expect(normaliserEntete(null)).toBe('');
  });
});

describe('nombreImport', () => {
  it('laisse passer les nombres', () => {
    expect(nombreImport(2166)).toBe(2166);
    expect(nombreImport(0)).toBe(0);
  });

  it('nettoie les séparateurs de milliers et la devise', () => {
    expect(nombreImport('44 960 F')).toBe(44960);
    expect(nombreImport('1.234.567')).toBe(1234567);
    expect(nombreImport('13 750')).toBe(13750);
  });

  it('reconnaît la décimale, virgule ou point', () => {
    expect(nombreImport('2 166,50')).toBe(2166.5);
    expect(nombreImport('1,234.50')).toBe(1234.5);
    expect(nombreImport('1,5')).toBe(1.5);
  });

  it('rend 0 sur une cellule vide ou illisible', () => {
    expect(nombreImport(null)).toBe(0);
    expect(nombreImport('néant')).toBe(0);
  });
});

describe('trouverEntete', () => {
  it('trouve la ligne d’entêtes sous le titre, quel que soit le nombre de lignes de tête', () => {
    expect(trouverEntete(EXPORT_HISTORIQUE)).toEqual({
      ligne: 1,
      colonnes: { code: 0, designation: 1, prix_achat: 2, prix_vente: 3, famille: 4 },
    });
  });

  it('suit les colonnes dans leur ordre réel', () => {
    const entete = trouverEntete([['Désignation', 'Famille', 'Code', 'Prix de vente', "Prix d'achat"]]);
    expect(entete?.colonnes).toEqual({ designation: 0, famille: 1, code: 2, prix_vente: 3, prix_achat: 4 });
  });

  it('rend null sans code ni désignation', () => {
    expect(trouverEntete([['Quantité', 'Dépôt']])).toBeNull();
  });
});

describe('lignesDepuisGrille', () => {
  it('ne perd aucun article de l’export historique', () => {
    const lignes = lignesDepuisGrille(EXPORT_HISTORIQUE);
    expect(lignes).toHaveLength(3);
    expect(lignes[0]).toEqual({
      code: '01408202625001',
      designation: '250001 METRE CARREAU 25/40',
      prix_achat: 2166,
      prix_vente: 2500,
      famille_nom: 'CARREAU',
    });
    expect(lignes.map((l) => l.code)).toEqual(['01408202625001', 'ABAT3', 'AMP1']);
  });

  it('écarte titres, entêtes répétés en tête de page et totaux', () => {
    const lignes = lignesDepuisGrille([
      ...EXPORT_HISTORIQUE,
      ['CODE', 'DESIGNATION', 'P. ACHAT', 'P. VENTE', 'FAMILLE'],
      ['AGR10', 'AGRIFFE 10/12', 2500, 3000, 'DIVERS'],
      [null, 'TOTAL GENERAL', 6246, 7200, null],
      ['NOMBRE D’ARTICLES', null, null, null, null],
    ]);
    expect(lignes.map((l) => l.code)).toEqual(['01408202625001', 'ABAT3', 'AMP1', 'AGR10']);
  });

  it('classe en DIVERS un article sans famille et tolère les colonnes absentes', () => {
    const lignes = lignesDepuisGrille([
      ['Code', 'Libellé'],
      ['X1', 'ARTICLE SANS PRIX'],
    ]);
    expect(lignes).toEqual([{ code: 'X1', designation: 'ARTICLE SANS PRIX', prix_achat: 0, prix_vente: 0, famille_nom: 'DIVERS' }]);
  });

  it('refuse une feuille sans entêtes plutôt que d’importer n’importe quoi', () => {
    expect(() => lignesDepuisGrille([['ABAT3', 'ABATANT WC', 1080, 1100, 'PLOMBERIE']])).toThrow(EntetesIntrouvablesError);
  });
});
