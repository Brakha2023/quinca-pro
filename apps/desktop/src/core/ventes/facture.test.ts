import { describe, expect, it } from 'vitest';
import { calculerTotaux, type LignePanier } from './panier';
import { preparerVente } from './vente';
import { avoirClient, estFormatImpression, lignesFacture, lignesFactureDepuisVente, recapFacture, recapVenteEnregistree } from './facture';

const ligne = (over: Partial<LignePanier> = {}): LignePanier => ({
  article_id: 'a1',
  code: 'SS20',
  designation: 'SIPHON DE SOL 20',
  unite: 'PIECE',
  prix_unitaire_ttc: 2000,
  tva_percent: 0,
  quantite: 10,
  remise_percent: 0,
  ...over,
});

describe('lignesFacture', () => {
  it("reprend la ligne de l'exemple : 10 × 2 000 HT sans remise ni TVA", () => {
    expect(lignesFacture([ligne()], 'DEPOT')).toEqual([
      { code: 'SS20', designation: 'SIPHON DE SOL 20', quantite: 10, prix_unitaire_ht: 2000, remise: 0, total_ht: 20000, tva: 0, depot: 'DEPOT' },
    ]);
  });

  it('convertit la remise de ligne en montant HT', () => {
    const [l] = lignesFacture([ligne({ remise_percent: 10 })], 'DEPOT');
    expect(l?.remise).toBe(2000);
    expect(l?.total_ht).toBe(18000);
  });

  it('isole la TVA de la ligne', () => {
    const [l] = lignesFacture([ligne({ prix_unitaire_ttc: 1180, tva_percent: 18, quantite: 1 })], 'MAGASIN');
    expect(l?.prix_unitaire_ht).toBe(1000);
    expect(l?.total_ht).toBe(1000);
    expect(l?.tva).toBe(180);
  });
});

describe('recapFacture', () => {
  const vente = (mode: 'ESPECES' | 'CREDIT', percu: number, client: unknown = null) =>
    preparerVente(
      { lignes: [ligne()], remise_globale_percent: 0, client: client as never, paiement: { mode_paiement: mode, montant_percu: percu }, livraison: null, notes: '' },
      'C1',
    );

  it('reprend les totaux de la vente', () => {
    const r = recapFacture(vente('ESPECES', 20000));
    expect(r).toMatchObject({ brut_ht: 20000, remise: 0, net_ht: 20000, tva: 0, net_a_payer: 20000, reste_a_payer: 0, comptant: true });
  });

  it('ne compte comme payé que ce qui reste en caisse, pas le rendu de monnaie', () => {
    expect(recapFacture(vente('ESPECES', 25000)).montant_paye).toBe(20000);
  });

  it('signale une vente à crédit par son reste à payer', () => {
    const credit = vente('CREDIT', 0, { id: 'c1', raison_sociale: 'X', plafond_credit: 100000, solde_actuel: 0, est_actif: true });
    const r = recapFacture(credit);
    expect(r.montant_paye).toBe(0);
    expect(r.reste_a_payer).toBe(20000);
    expect(r.comptant).toBe(false);
  });

  it('reprend la remise globale dans le pied de facture', () => {
    const totaux = calculerTotaux([ligne()], 10);
    expect(totaux.total_remise).toBe(2000);
    expect(totaux.total_ttc).toBe(18000);
  });
});

describe('avoirClient', () => {
  it('ne retient qu’un solde créditeur', () => {
    expect(avoirClient({ solde_actuel: -5000 })).toBe(5000);
    expect(avoirClient({ solde_actuel: 12000 })).toBe(0);
    expect(avoirClient(null)).toBe(0);
  });
});

describe('estFormatImpression', () => {
  it('ne reconnaît que les deux formats', () => {
    expect(estFormatImpression('A4')).toBe(true);
    expect(estFormatImpression('TICKET')).toBe(true);
    expect(estFormatImpression('PDF')).toBe(false);
  });
});

describe('réédition depuis une vente enregistrée', () => {
  const stockee = { total_brut_ht: 20000, total_remise: 2000, total_net_ht: 18000, total_tva: 0, total_ttc: 18000, montant_percu: 20000, monnaie: 2000, reste_a_payer: 0 };

  it('reprend les totaux stockés et déduit le rendu de monnaie', () => {
    expect(recapVenteEnregistree(stockee)).toEqual({
      montant_paye: 18000, reste_a_payer: 0, avoir: 0,
      brut_ht: 20000, remise: 2000, net_ht: 18000, tva: 0, net_a_payer: 18000, comptant: true,
    });
  });

  it('marque en crédit une vente qui laisse un reste', () => {
    expect(recapVenteEnregistree({ ...stockee, montant_percu: 0, monnaie: 0, reste_a_payer: 18000 }).comptant).toBe(false);
  });

  it('tolère une vente aux colonnes nulles', () => {
    expect(recapVenteEnregistree({ total_brut_ht: null, total_remise: null, total_net_ht: null, total_tva: null, total_ttc: null, montant_percu: null, monnaie: null, reste_a_payer: null }).net_a_payer).toBe(0);
  });

  it('ne recalcule pas les montants : la facture rééditée porte ceux de l’originale', () => {
    const lignes = [{ id: 'l1', vente_id: 'v1', article_id: 'a1', code_article: 'SS20', designation: 'SIPHON', quantite: 10, prix_unitaire_ht: 2000, prix_unitaire_ttc: 2000, remise_percent: 10, tva_percent: 0, total_ht: 18000, total_ttc: 18000, depot_id: 'd1' }];
    expect(lignesFactureDepuisVente(lignes, (id) => (id === 'd1' ? 'DEPOT' : '—'))).toEqual([
      { code: 'SS20', designation: 'SIPHON', quantite: 10, prix_unitaire_ht: 2000, remise: 2000, total_ht: 18000, tva: 0, depot: 'DEPOT' },
    ]);
  });
});
