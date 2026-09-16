import { describe, expect, it } from 'vitest';
import { articleFormSchema, articleFromRow, preparerImport } from './article';

describe('articleFormSchema', () => {
  it('normalise le code et convertit les nombres saisis', () => {
    const result = articleFormSchema.parse({
      code: ' rob-01 ',
      designation: 'Robinet',
      prix_achat: '8500',
      prix_vente: '12500',
      prix_vip: '',
    });
    expect(result.code).toBe('ROB-01');
    expect(result.prix_achat).toBe(8500);
    expect(result.tva).toBe(18);
    expect(result.unite).toBe('PIECE');
    expect(result.prix_vip).toBe('');
  });

  it('refuse un stock max inférieur au stock min', () => {
    const result = articleFormSchema.safeParse({
      code: 'A', designation: 'A', prix_achat: 1, prix_vente: 2, stock_min: 10, stock_max: 5,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['stock_max']);
  });

  it('refuse les champs obligatoires vides', () => {
    const result = articleFormSchema.safeParse({ code: '', designation: '', prix_achat: 0, prix_vente: 0 });
    expect(result.success).toBe(false);
  });
});

describe('articleFromRow', () => {
  it('applique les valeurs par défaut aux colonnes nulles', () => {
    const article = articleFromRow({
      id: '1', code: 'X', designation: 'X', famille_id: null, sous_famille: null,
      prix_achat: null, prix_vente: null, prix_vip: null, tva: null, stock_min: null, stock_max: null,
      unite: null, image_url: null, filiale_id: 'f', est_actif: null, created_at: null, updated_at: null,
    });
    expect(article.prix_achat).toBe(0);
    expect(article.tva).toBe(18);
    expect(article.unite).toBe('PIECE');
    expect(article.est_actif).toBe(true);
  });
});

describe('preparerImport', () => {
  it('ignore les codes existants, les doublons et les lignes vides', () => {
    const { valides, ignores } = preparerImport(
      [
        { code: 'a1', designation: 'Un', prix_achat: 1, prix_vente: 2, famille_nom: 'DIV' },
        { code: 'A1', designation: 'Doublon', prix_achat: 1, prix_vente: 2, famille_nom: 'DIV' },
        { code: 'EXIST', designation: 'Déjà là', prix_achat: 1, prix_vente: 2, famille_nom: 'DIV' },
        { code: '', designation: 'Sans code', prix_achat: 1, prix_vente: 2, famille_nom: 'DIV' },
      ],
      new Set(['EXIST']),
    );
    expect(valides.map((v) => v.code)).toEqual(['A1']);
    expect(ignores.map((i) => i.ligne)).toEqual([2, 3, 4]);
  });
});
