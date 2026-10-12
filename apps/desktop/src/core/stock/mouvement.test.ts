import { describe, expect, it } from 'vitest';
import { StockInsuffisantError, appliquerMouvement, calculerCoutMoyenPondere, genererNumeroBon, statutStock } from './mouvement';
import { entreeStockSchema, fusionnerLignes } from './documents';

describe('appliquerMouvement', () => {
  it('entrée : augmente la quantité et recalcule le coût moyen pondéré', () => {
    const r = appliquerMouvement({ quantite: 10, quantite_reservee: 0, cout_moyen: 100 }, 'ENTREE_ACHAT', 10, 200);
    expect(r).toEqual({ quantite_avant: 10, quantite_apres: 20, quantite: 10, cout_moyen: 150 });
  });

  it('entrée sans coût : garde le coût moyen', () => {
    const r = appliquerMouvement({ quantite: 5, quantite_reservee: 0, cout_moyen: 100 }, 'RETOUR_CLIENT', 1);
    expect(r.cout_moyen).toBe(100);
  });

  it('sortie : refuse au-delà du disponible (réservations comprises)', () => {
    const etat = { quantite: 10, quantite_reservee: 4, cout_moyen: 0 };
    expect(() => appliquerMouvement(etat, 'SORTIE_DESTOCKAGE', 7)).toThrow(StockInsuffisantError);
    expect(appliquerMouvement(etat, 'SORTIE_DESTOCKAGE', 6).quantite_apres).toBe(4);
  });

  it('sortie forcée autorisée pour un ajustement assumé', () => {
    const r = appliquerMouvement({ quantite: 2, quantite_reservee: 0, cout_moyen: 0 }, 'CASSE', 5, null, { autoriserNegatif: true });
    expect(r.quantite_apres).toBe(-3);
  });

  it('inventaire : fixe la quantité et enregistre l’écart', () => {
    const r = appliquerMouvement({ quantite: 12, quantite_reservee: 0, cout_moyen: 0 }, 'INVENTAIRE', 9);
    expect(r).toMatchObject({ quantite_avant: 12, quantite_apres: 9, quantite: -3 });
  });

  it('refuse les quantités invalides', () => {
    const etat = { quantite: 0, quantite_reservee: 0, cout_moyen: 0 };
    expect(() => appliquerMouvement(etat, 'ENTREE_ACHAT', 0)).toThrow();
    expect(() => appliquerMouvement(etat, 'ENTREE_ACHAT', -1)).toThrow();
    expect(() => appliquerMouvement(etat, 'ENTREE_ACHAT', NaN)).toThrow();
  });
});

describe('calculerCoutMoyenPondere', () => {
  it('ignore un stock négatif et prend le coût de l’entrée', () => {
    expect(calculerCoutMoyenPondere(-5, 100, 10, 300)).toBe(300);
  });
});

describe('statutStock', () => {
  it('classe rupture / faible / ok / surstock', () => {
    expect(statutStock(0, 5, 50)).toBe('RUPTURE');
    expect(statutStock(5, 5, 50)).toBe('FAIBLE');
    expect(statutStock(20, 5, 50)).toBe('OK');
    expect(statutStock(60, 5, 50)).toBe('SURSTOCK');
    expect(statutStock(60, 5, 0)).toBe('OK');
  });
});

describe('genererNumeroBon', () => {
  it('produit un numéro daté avec suffixe aléatoire', () => {
    const n = genererNumeroBon('ENT', new Date('2026-09-16T10:00:00Z'));
    expect(n).toMatch(/^ENT-20260916-[A-Z2-9]{4}$/);
    expect(genererNumeroBon('ENT')).not.toBe(genererNumeroBon('ENT'));
  });
});

describe('fusionnerLignes', () => {
  it('additionne les quantités d’un même article', () => {
    const r = fusionnerLignes([
      { article_id: 'a', quantite: 2 },
      { article_id: 'b', quantite: 1 },
      { article_id: 'a', quantite: 3 },
    ]);
    expect(r).toEqual([{ article_id: 'a', quantite: 5 }, { article_id: 'b', quantite: 1 }]);
  });
});

describe('entreeStockSchema : provenance', () => {
  const base = { depot_id: 'd1', lignes: [{ article_id: 'a1', quantite: 5 }] };

  it("retient le fournisseur d'une entrée d'achat", () => {
    expect(entreeStockSchema.parse({ ...base, type: 'ENTREE_ACHAT', fournisseur_id: 'f1' }).fournisseur_id).toBe('f1');
  });

  it('efface le fournisseur sur un retour client', () => {
    expect(entreeStockSchema.parse({ ...base, type: 'RETOUR_CLIENT', fournisseur_id: 'f1' }).fournisseur_id).toBeNull();
  });

  it('accepte une entrée sans fournisseur', () => {
    expect(entreeStockSchema.parse({ ...base, type: 'ENTREE_ACHAT' }).fournisseur_id).toBeNull();
    expect(entreeStockSchema.parse({ ...base, type: 'ENTREE_ACHAT', fournisseur_id: '' }).fournisseur_id).toBeNull();
  });
});
