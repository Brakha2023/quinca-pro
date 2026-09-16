import { describe, expect, it } from 'vitest';
import { achatSchema, calculerDette, totauxAchat } from './fournisseur';

describe('fournisseur', () => {
  it('calcule la dette', () => {
    expect(calculerDette({ solde_initial: 10000, cumul_factures: 50000, cumul_reglements: 35000 })).toBe(25000);
  });
  it('calcule les totaux d’un achat avec TVA', () => {
    const achat = achatSchema.parse({ fournisseur_id: 'f', depot_id: 'd', tva_percent: 18, lignes: [{ article_id: 'a', quantite: 10, cout_unitaire: '4500' }, { article_id: 'b', quantite: 2, cout_unitaire: 8500 }] });
    expect(totauxAchat(achat)).toEqual({ total_ht: 62000, total_tva: 11160, total_ttc: 73160 });
  });
  it('refuse un achat sans ligne ou sans coût', () => {
    expect(achatSchema.safeParse({ fournisseur_id: 'f', depot_id: 'd', lignes: [] }).success).toBe(false);
    expect(achatSchema.safeParse({ fournisseur_id: 'f', depot_id: 'd', lignes: [{ article_id: 'a', quantite: 1, cout_unitaire: '' }] }).success).toBe(false);
  });
});
