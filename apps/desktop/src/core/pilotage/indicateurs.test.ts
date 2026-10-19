import { describe, expect, it } from 'vitest';
import { consolider, evolution, indicateurs, pointsDeVigilance, type IndicateursBruts } from './indicateurs';

const bruts = (p: Partial<IndicateursBruts> = {}): Partial<IndicateursBruts> => ({
  filiale_id: 'f1', filiale_code: 'ABJ', filiale_nom: 'Abidjan',
  ca_ht: 1_000_000, ca_ttc: 1_180_000, ventes: 10, encaisse: 900_000,
  cout_ventes: 700_000, charges: 150_000,
  creances: 280_000, dettes: 450_000, valeur_stock: 5_000_000, tresorerie: 320_000,
  livraisons_attente: 3, livraisons_retard: 1, commandes_ouvertes: 2, clients_servis: 7,
  ...p,
});

describe('indicateurs', () => {
  it('déduit la marge du coût d’achat de ce qui est sorti', () => {
    const i = indicateurs(bruts());
    expect(i.marge).toBe(300_000);
    expect(i.taux_marge).toBe(30);
  });

  it('retranche les dépenses de la marge pour le résultat', () => {
    expect(indicateurs(bruts()).resultat).toBe(150_000);
  });

  it('donne un résultat négatif quand les dépenses dépassent la marge', () => {
    expect(indicateurs(bruts({ charges: 400_000 })).resultat).toBe(-100_000);
  });

  it('calcule le panier sur le TTC, puisque c’est ce que le client paie', () => {
    expect(indicateurs(bruts()).panier_moyen).toBe(118_000);
  });

  it('ne divise pas par zéro quand rien n’a été vendu', () => {
    const i = indicateurs(bruts({ ca_ht: 0, ca_ttc: 0, ventes: 0, cout_ventes: 0 }));
    expect(i.taux_marge).toBe(0);
    expect(i.panier_moyen).toBe(0);
  });

  it('ne rend jamais un reste à encaisser négatif', () => {
    // Un client qui règle une ancienne facture en même temps : l'encaissé dépasse le CA.
    expect(indicateurs(bruts({ encaisse: 1_500_000 })).reste_a_encaisser).toBe(0);
  });

  it('lit une ligne SQL vide sans se plaindre', () => {
    const i = indicateurs({});
    expect(i.ca_ht).toBe(0);
    expect(i.marge).toBe(0);
    expect(i.filiale_nom).toBe('');
  });

  it('tient une marge négative : on a vendu à perte', () => {
    const i = indicateurs(bruts({ cout_ventes: 1_200_000 }));
    expect(i.marge).toBe(-200_000);
    expect(i.taux_marge).toBe(-20);
  });
});

describe('consolider', () => {
  const a = indicateurs(bruts());
  const b = indicateurs(bruts({ filiale_id: 'f2', filiale_nom: 'Bouaké', ca_ht: 500_000, ca_ttc: 590_000, ventes: 5, cout_ventes: 400_000, charges: 50_000, creances: 120_000 }));

  it('additionne les filiales', () => {
    const g = consolider([a, b]);
    expect(g.ca_ht).toBe(1_500_000);
    expect(g.ventes).toBe(15);
    expect(g.creances).toBe(400_000);
  });

  it('recalcule les taux au lieu d’en faire la moyenne', () => {
    const g = consolider([a, b]);
    // 400 000 de marge sur 1 500 000 de CA HT : 26,7 %, et non (30 + 20) / 2.
    expect(g.marge).toBe(400_000);
    expect(g.taux_marge).toBe(26.7);
  });

  it('rend un groupe à zéro quand il n’y a aucune filiale', () => {
    const g = consolider([]);
    expect(g.ca_ttc).toBe(0);
    expect(g.taux_marge).toBe(0);
  });
});

describe('evolution', () => {
  it('donne la variation en pourcentage', () => {
    expect(evolution(120, 100)).toBe(20);
    expect(evolution(80, 100)).toBe(-20);
  });

  it('ne compare pas à rien', () => {
    expect(evolution(500, 0)).toBeNull();
  });

  it('compare à une valeur négative sans inverser le signe', () => {
    // De −100 à −50 : on remonte, donc +50 %.
    expect(evolution(-50, -100)).toBe(50);
  });
});

describe('pointsDeVigilance', () => {
  it('lève ce qui réclame une décision', () => {
    const v = pointsDeVigilance(indicateurs(bruts()), 4);
    expect(v).toMatchObject({ creances: true, dettes: true, livraisons_retard: true, ruptures: true, tresorerie_negative: false });
    expect(v.nombre).toBe(4);
  });

  it('ne crie pas « marge négative » quand rien n’a été vendu', () => {
    const v = pointsDeVigilance(indicateurs(bruts({ ca_ht: 0, cout_ventes: 0, charges: 0, creances: 0, dettes: 0, livraisons_retard: 0 })), 0);
    expect(v.marge_negative).toBe(false);
    expect(v.nombre).toBe(0);
  });

  it('signale une trésorerie à découvert', () => {
    expect(pointsDeVigilance(indicateurs(bruts({ tresorerie: -50_000 })), 0).tresorerie_negative).toBe(true);
  });
});
