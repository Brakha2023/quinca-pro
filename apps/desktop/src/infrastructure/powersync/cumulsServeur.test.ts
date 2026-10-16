import { describe, expect, it } from 'vitest';
import { sansCumulsServeur } from './cumulsServeur';

describe('sansCumulsServeur', () => {
  it('laisse passer intactes les tables sans cumul serveur', () => {
    expect(sansCumulsServeur('articles', { code: 'CIM', prix_vente: 5900 })).toEqual({ code: 'CIM', prix_vente: 5900 });
  });

  it('retire la quantité et le coût moyen d’une ligne de stock, garde son identité', () => {
    expect(sansCumulsServeur('stocks', {
      article_id: 'a1', depot_id: 'd1', filiale_id: 'f1', quantite_reservee: 0,
      quantite: 100, quantite_disponible: 100, cout_moyen: 4500, date_dernier_mouvement: '2026-10-16',
    })).toEqual({ article_id: 'a1', depot_id: 'd1', filiale_id: 'f1', quantite_reservee: 0 });
  });

  it('rend null quand l’opération ne portait que des cumuls', () => {
    expect(sansCumulsServeur('stocks', { quantite: 95, quantite_disponible: 95 })).toBeNull();
    expect(sansCumulsServeur('caisses', { solde_actuel: 75000 })).toBeNull();
  });

  it('garde les colonnes d’une caisse qui ne sont pas un cumul', () => {
    expect(sansCumulsServeur('caisses', { nom: 'Caisse principale', solde_actuel: 0, est_active: 1 }))
      .toEqual({ nom: 'Caisse principale', est_active: 1 });
  });

  it('tolère une opération sans données', () => {
    expect(sansCumulsServeur('stocks', undefined)).toBeNull();
    expect(sansCumulsServeur('articles', undefined)).toEqual({});
  });
});
