import { describe, expect, it } from 'vitest';
import {
  categoriesSaisissables, libellesCategories, motifCategorieRefusee, normaliserCodeCategorie,
  type CategorieTresorerie,
} from './categories';

const categorie = (code: string, libelle: string, type: 'RECETTE' | 'DEPENSE' = 'DEPENSE', est_active = true): CategorieTresorerie =>
  ({ id: code.toLowerCase(), code, libelle, type, est_active });

describe('normaliserCodeCategorie', () => {
  it('majuscules, sans accent ni espace', () => {
    expect(normaliserCodeCategorie('Frais de dédouanement')).toBe('FRAIS_DE_DEDOUANEMENT');
  });

  it('réduit la ponctuation à un seul tiret bas', () => {
    expect(normaliserCodeCategorie("Gardiennage (nuit) — 2026")).toBe('GARDIENNAGE_NUIT_2026');
  });

  it('rend vide quand il n’y a rien à coder', () => {
    expect(normaliserCodeCategorie('—  !')).toBe('');
  });

  it('borne la longueur du code', () => {
    expect(normaliserCodeCategorie('a'.repeat(60))).toHaveLength(30);
  });
});

describe('motifCategorieRefusee', () => {
  it('accepte une catégorie nouvelle', () => {
    expect(motifCategorieRefusee('Gardiennage', [])).toBeNull();
  });

  it('refuse un libellé sans lettre ni chiffre', () => {
    expect(motifCategorieRefusee('– —', [])).toMatch(/au moins une lettre/);
  });

  it('refuse un code que les modules métier produisent', () => {
    // Un règlement client naît d'une pièce ; le nommer à la main brouillerait le journal.
    expect(motifCategorieRefusee('Règlement client', [])).toMatch(/réservé/);
  });

  it('refuse une catégorie intégrée et renvoie à la liste', () => {
    expect(motifCategorieRefusee('transport', [])).toMatch(/existe déjà/);
  });

  it('renvoie à la réactivation quand la catégorie a été retirée', () => {
    const motif = motifCategorieRefusee('Gardiennage', [categorie('GARDIENNAGE', 'Gardiennage', 'DEPENSE', false)]);
    expect(motif).toMatch(/réactivez-la/);
  });

  it('refuse le même code dans l’autre sens', () => {
    // Un code ne peut pas désigner une recette ici et une dépense là : le
    // journal les additionnerait sous un seul libellé.
    expect(motifCategorieRefusee('Caution', [categorie('CAUTION', 'Caution', 'RECETTE')])).toMatch(/existe déjà/);
  });
});

describe('categoriesSaisissables', () => {
  const ajoutees = [
    categorie('GARDIENNAGE', 'Gardiennage'),
    categorie('DEDOUANEMENT', 'Dédouanement'),
    categorie('CAUTION', 'Caution reçue', 'RECETTE'),
    categorie('PATENTE', 'Patente', 'DEPENSE', false),
  ];

  it('met les intégrées d’abord, puis les siennes par ordre alphabétique', () => {
    const choix = categoriesSaisissables('DEPENSE', ajoutees);
    expect(choix[0]).toEqual({ code: 'TRANSPORT', libelle: 'Transport', integree: true });
    const siennes = choix.filter((c) => !c.integree).map((c) => c.libelle);
    expect(siennes).toEqual(['Dédouanement', 'Gardiennage']);
  });

  it('laisse dehors les désactivées et celles de l’autre sens', () => {
    const codes = categoriesSaisissables('DEPENSE', ajoutees).map((c) => c.code);
    expect(codes).not.toContain('PATENTE');
    expect(codes).not.toContain('CAUTION');
  });

  it('propose les recettes ajoutées du bon sens', () => {
    expect(categoriesSaisissables('RECETTE', ajoutees).map((c) => c.code)).toContain('CAUTION');
  });
});

describe('libellesCategories', () => {
  it('garde les intégrées et ajoute les siennes, désactivées comprises', () => {
    const table = libellesCategories([categorie('PATENTE', 'Patente', 'DEPENSE', false)]);
    expect(table.LOYER).toBe('Loyer');
    // Un mouvement de l'an dernier doit continuer à se lire en clair.
    expect(table.PATENTE).toBe('Patente');
  });
});
