import { describe, expect, it } from 'vitest';
import { ajouterAuPanier, calculerLigne, calculerTotaux, type LignePanier } from './panier';
import { VenteInvalideError, preparerVente } from './vente';
import type { Client } from '../clients';

const ligne = (over: Partial<LignePanier> = {}): LignePanier => ({
  article_id: 'a', code: 'A', designation: 'Art', unite: 'PIECE', prix_unitaire_ttc: 11800, tva_percent: 18, quantite: 1, remise_percent: 0, ...over,
});
const client = (over: Partial<Client> = {}): Client => ({
  id: 'c', code: 'C', raison_sociale: 'C', mobile: null, email: null, adresse: null, contact: null,
  solde_initial: 0, cumul_factures: 0, cumul_reglements: 0, solde_actuel: 0, plafond_credit: 100000, filiale_id: 'f', est_actif: true, ...over,
});

describe('panier', () => {
  it('calcule une ligne TTC → HT avec remise', () => {
    const l = calculerLigne(ligne({ quantite: 2, remise_percent: 10 }));
    expect(l.prix_unitaire_ht).toBe(10000);
    expect(l.total_ttc).toBe(21240);
    expect(l.total_ht).toBe(18000);
  });

  it('calcule les totaux avec TVA par ligne et remise globale', () => {
    const t = calculerTotaux([ligne({ quantite: 2 }), ligne({ article_id: 'b', prix_unitaire_ttc: 1000, tva_percent: 0 })], 10);
    expect(t.total_brut_ht).toBe(21000);
    expect(t.total_ttc).toBe(22140); // (23600 + 1000) × 0,9
    expect(t.total_net_ht).toBe(18900);
    expect(t.total_tva).toBe(3240);
    expect(t.total_remise).toBe(2100);
    expect(t.nombre_articles).toBe(3);
  });

  it('cumule les quantités d’un même article', () => {
    const p = ajouterAuPanier([ligne()], ligne({ quantite: 3 }));
    expect(p).toHaveLength(1);
    expect(p[0].quantite).toBe(4);
  });
});

describe('preparerVente', () => {
  const base = { lignes: [ligne({ quantite: 2 })], remise_globale_percent: 0, client: null, livraison: null, notes: '' };

  it('espèces : exige le montant remis et rend la monnaie', () => {
    expect(() => preparerVente({ ...base, paiement: { mode_paiement: 'ESPECES', montant_percu: 20000 } }, 'C01')).toThrow(VenteInvalideError);
    const v = preparerVente({ ...base, paiement: { mode_paiement: 'ESPECES', montant_percu: 25000 } }, 'C01', new Date('2026-09-16T10:00:00Z'));
    expect(v).toMatchObject({ monnaie: 1400, montant_encaisse: 23600, reste_a_payer: 0 });
    expect(v.numero).toMatch(/^C01-20260916-[A-Z2-9]{4}$/);
  });

  it('crédit : client obligatoire, dans le plafond', () => {
    expect(() => preparerVente({ ...base, paiement: { mode_paiement: 'CREDIT', montant_percu: 0 } }, 'C01')).toThrow(/client en compte/);
    expect(() => preparerVente({ ...base, client: client({ solde_actuel: 90000 }), paiement: { mode_paiement: 'CREDIT', montant_percu: 0 } }, 'C01')).toThrow(/Plafond/);
    const v = preparerVente({ ...base, client: client(), paiement: { mode_paiement: 'CREDIT', montant_percu: 999 } }, 'C01');
    expect(v).toMatchObject({ montant_percu: 0, montant_encaisse: 0, reste_a_payer: 23600, monnaie: 0 });
  });

  it('mobile money partiel : le reste devient une créance', () => {
    const v = preparerVente({ ...base, client: client(), paiement: { mode_paiement: 'MOBILE_MONEY', montant_percu: 10000 } }, 'C01');
    expect(v).toMatchObject({ montant_encaisse: 10000, reste_a_payer: 13600 });
    expect(() => preparerVente({ ...base, paiement: { mode_paiement: 'MOBILE_MONEY', montant_percu: 30000 } }, 'C01')).toThrow(/dépasse/);
  });

  it('refuse un ticket vide', () => {
    expect(() => preparerVente({ ...base, lignes: [], paiement: { mode_paiement: 'ESPECES', montant_percu: 0 } }, 'C01')).toThrow(/vide/);
  });
});
