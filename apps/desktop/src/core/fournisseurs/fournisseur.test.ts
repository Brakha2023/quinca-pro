import { describe, expect, it } from 'vitest';
import { achatSchema, calculerDette, totauxAchat, totauxCommande, valoriserReception, statutApresReception, construireReleve, composerRelance } from './fournisseur';

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

describe('bons de commande et réceptions', () => {
  const commande = { remise_percent: 10, tva_percent: 0 };
  const lignes = [
    { id: 'l1', commande_id: 'c', article_id: 'a', code_article: 'A', designation: 'Pied de lavabo', unite: 'PIECE', quantite: 20, quantite_recue: 0, prix_unitaire_ht: 5500, total_ht: 110000 },
    { id: 'l2', commande_id: 'c', article_id: 'b', code_article: 'B', designation: 'Robinet', unite: 'PIECE', quantite: 5, quantite_recue: 5, prix_unitaire_ht: 1000, total_ht: 5000 },
  ];

  it('calcule brut, remise, net, TVA, net à payer', () => {
    expect(totauxCommande({ remise_percent: 10, tva_percent: 18, lignes: [{ quantite: 20, prix_unitaire_ht: 5500 }] })).toEqual({ brut_ht: 110000, remise: 11000, net_ht: 99000, tva: 17820, net_a_payer: 116820 });
  });

  it('valorise une réception partielle au prix remisé et refuse au-delà du commandé', () => {
    const r = valoriserReception(commande, lignes, { depot_id: 'd', reference: '', lignes: [{ ligne_id: 'l1', quantite_recue: 8 }, { ligne_id: 'l2', quantite_recue: 0 }] });
    expect(r.total_ttc).toBe(39600); // 8 × 5500 × 0,9
    expect(r.lignes[0].cout_unitaire).toBe(4950);
    expect(() => valoriserReception(commande, lignes, { depot_id: 'd', reference: '', lignes: [{ ligne_id: 'l2', quantite_recue: 1 }] })).toThrow(/au-delà/);
    expect(statutApresReception([{ quantite: 20, quantite_recue: 8 }, { quantite: 5, quantite_recue: 5 }])).toBe('PARTIELLE');
    expect(statutApresReception([{ quantite: 20, quantite_recue: 20 }])).toBe('LIVREE');
  });
});

describe('relevé et relance', () => {
  it('construit le relevé chronologique avec solde cumulé', () => {
    const releve = construireReleve(
      { solde_initial: 1000, date_effet_solde: '2026-01-01' },
      [{ numero: 'ACH-1', date_commande: '2026-02-01', date_reception: '2026-02-02', total_recu_ttc: 5000 }, { numero: 'BC-2', date_commande: '2026-03-01', date_reception: null, total_recu_ttc: 0 }],
      [{ numero: 'RGF-1', date_reglement: '2026-02-10', montant: 4000, type_reglement: 'VIREMENT' }],
    );
    expect(releve.map((l) => [l.piece, l.debit, l.credit, l.solde])).toEqual([['', 0, 0, 1000], ['ACH-1', 5000, 0, 6000], ['RGF-1', 0, 4000, 2000]]);
  });

  it('compose une relance pour commandes en attente et avoir', () => {
    const { objet, corps } = composerRelance(
      { filiale: { nom: 'Filiale Abidjan', telephone: '27 32 79 50 90' }, fournisseur: { raison_sociale: 'SODIS', interlocuteur: 'M. Koné', solde_actuel: -25000 },
        commandesEnAttente: [{ numero: 'BC-20260918-AB12', date_commande: '2026-09-18T10:00:00Z', date_livraison_prevue: null, total_ttc: 110000 }], signataire: 'Awa Koné' },
      (n) => `${n} F`, (iso) => iso ? iso.slice(0, 10) : '',
    );
    expect(objet).toBe('Relance — commande BC-20260918-AB12');
    expect(corps).toContain('Bonjour M. Koné');
    expect(corps).toContain('BC-20260918-AB12 du 2026-09-18 — 110000 F');
    expect(corps).toContain('avoir de 25000 F');
    expect(corps).toContain('Awa Koné');
  });
});
