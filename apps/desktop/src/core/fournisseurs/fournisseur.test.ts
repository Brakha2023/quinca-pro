import { describe, expect, it } from 'vitest';
import { achatSchema, calculerDette, composerRelance, construireReleve, partRemiseRecue, statutApresReception, totalLigneCommande, totauxAchat, totauxCommande, valoriserReception } from './fournisseur';
import { repartirRemiseGlobale } from '../stock';

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
  // Une pièce d'avant : remise globale en pourcentage, aucun franc.
  const commande = { remise_montant: 0, remise_percent: 10, tva_percent: 0 };
  const lignes = [
    { id: 'l1', commande_id: 'c', article_id: 'a', code_article: 'A', designation: 'Pied de lavabo', unite: 'PIECE', quantite: 20, quantite_recue: 0, prix_unitaire_ht: 5500, remise_montant: 0, remise_percent: 0, total_ht: 110000 },
    { id: 'l2', commande_id: 'c', article_id: 'b', code_article: 'B', designation: 'Robinet', unite: 'PIECE', quantite: 5, quantite_recue: 5, prix_unitaire_ht: 1000, remise_montant: 0, remise_percent: 0, total_ht: 5000 },
  ];

  /*
   * La remise en pourcentage n'est plus saisie, mais les bons d'avant la
   * portent : ils doivent se calculer exactement comme à leur création. Un
   * relevé fournisseur qui changerait de total après une mise à jour ne serait
   * plus un relevé.
   */
  it('calcule encore les bons d’avant, à la remise en pourcentage', () => {
    expect(totauxCommande({ remise_percent: 10, tva_percent: 18, lignes: [{ quantite: 20, prix_unitaire_ht: 5500 }] })).toEqual({ brut_ht: 110000, remise_lignes: 0, remise_globale: 11000, remise: 11000, net_ht: 99000, tva: 17820, net_a_payer: 116820 });
  });

  it('calcule brut, remise en francs, net, TVA, net à payer', () => {
    // 110 000 − 15 000 = 95 000 ; TVA 18 % = 17 100.
    expect(totauxCommande({ remise_montant: 15000, tva_percent: 18, lignes: [{ quantite: 20, prix_unitaire_ht: 5500, remise_montant: 15000 }] }))
      .toEqual({ brut_ht: 110000, remise_lignes: 0, remise_globale: 15000, remise: 15000, net_ht: 95000, tva: 17100, net_a_payer: 112100 });
  });

  /*
   * Le net du bon doit être la somme de ses lignes : c'est ce qui permet au
   * document de s'équilibrer sans rien reconstituer, et à une réception
   * partielle de se valoriser ligne par ligne.
   */
  it('répartit la remise du bon et retombe sur la somme des lignes', () => {
    const lignesBon = [{ quantite: 10, prix_unitaire_ht: 5000 }, { quantite: 4, prix_unitaire_ht: 2500 }];
    const parts = repartirRemiseGlobale(lignesBon.map((l) => ({ ...l, cout_unitaire: l.prix_unitaire_ht })), 6000);
    const avecParts = parts.map((pt) => ({ quantite: pt.ligne.quantite, prix_unitaire_ht: pt.ligne.prix_unitaire_ht, remise_montant: pt.remise }));
    const t = totauxCommande({ remise_montant: 6000, tva_percent: 0, lignes: avecParts });
    expect(parts.reduce((s, pt) => s + pt.remise, 0)).toBe(6000);
    expect(avecParts.reduce((s, l) => s + totalLigneCommande(l), 0)).toBe(t.net_ht);
    expect(t.net_ht).toBe(54000);
  });

  // Un rabais saisi trop grand ramène le bon à zéro, il ne le rend pas négatif.
  it('ne laisse pas la remise dépasser le bon', () => {
    const t = totauxCommande({ remise_montant: 999999, tva_percent: 18, lignes: [{ quantite: 2, prix_unitaire_ht: 1000, remise_montant: 999999 }] });
    expect(t.remise_globale).toBe(2000);
    expect(t.net_ht).toBe(0);
    expect(t.net_a_payer).toBe(0);
  });

  /*
   * La part d'une ligne vaut pour la quantité **commandée** : n'en recevoir que
   * la moitié ne doit faire entrer que la moitié du rabais, sinon la première
   * réception valoriserait trop bas et la suivante trop haut.
   */
  it('proratise la remise d’une ligne à ce qui est reçu', () => {
    const l = { quantite: 10, remise_montant: 1000 };
    expect(partRemiseRecue(l, 10)).toBe(1000);
    expect(partRemiseRecue(l, 4)).toBe(400);
    expect(partRemiseRecue(l, 0)).toBe(0);
    expect(partRemiseRecue({ quantite: 10 }, 4)).toBe(0);
  });

  it('entre en stock au coût net de la remise du bon, en francs', () => {
    const ligneFrancs = {
      id: 'lf', commande_id: 'c', article_id: 'a', code_article: 'A', designation: 'Ciment', unite: 'SAC',
      quantite: 10, quantite_recue: 0, prix_unitaire_ht: 5000, remise_montant: 5000, remise_percent: 0, total_ht: 45000,
    };
    const r = valoriserReception(
      { remise_montant: 5000, remise_percent: 0, tva_percent: 0 },
      [ligneFrancs],
      { depot_id: 'd', reference: '', lignes: [{ ligne_id: 'lf', quantite_recue: 4 }] },
    );
    // 5 000 − (5 000 / 10) = 4 500 le sac ; 4 sacs = 18 000.
    expect(r.lignes[0]?.cout_unitaire).toBe(4500);
    expect(r.total_ttc).toBe(18000);
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

describe('remise de ligne sur un bon de commande', () => {
  const bon = {
    remise_percent: 0,
    tva_percent: 18,
    lignes: [
      { quantite: 10, prix_unitaire_ht: 1000, remise_percent: 10 },
      { quantite: 5, prix_unitaire_ht: 2000, remise_percent: 0 },
    ],
  };

  it('déduit la remise article par article', () => {
    expect(totalLigneCommande(bon.lignes[0]!)).toBe(9000);
    expect(totalLigneCommande(bon.lignes[1]!)).toBe(10000);
  });

  it('détaille les deux niveaux de remise dans les totaux', () => {
    const t = totauxCommande(bon);
    expect(t.brut_ht).toBe(20000);
    expect(t.remise_lignes).toBe(1000);
    expect(t.remise_globale).toBe(0);
    expect(t.net_ht).toBe(19000);
    expect(t.tva).toBe(3420);
    expect(t.net_a_payer).toBe(22420);
  });

  it('applique la remise globale après les remises de ligne, pas avant', () => {
    const t = totauxCommande({ ...bon, remise_percent: 5 });
    expect(t.remise_lignes).toBe(1000);
    expect(t.remise_globale).toBe(950); // 5 % de 19 000, pas de 20 000
    expect(t.remise).toBe(1950);
    expect(t.net_ht).toBe(18050);
  });

  it('reste compatible avec un bon sans remise de ligne', () => {
    const t = totauxCommande({ remise_percent: 10, tva_percent: 0, lignes: [{ quantite: 2, prix_unitaire_ht: 5000 }] });
    expect(t.brut_ht).toBe(10000);
    expect(t.remise_lignes).toBe(0);
    expect(t.net_ht).toBe(9000);
  });
});

describe('valoriserReception avec remise de ligne', () => {
  const ligne = {
    id: 'l1', commande_id: 'c1', article_id: 'a1', code_article: 'CIM', designation: 'Ciment', unite: 'SAC',
    quantite: 10, quantite_recue: 0, prix_unitaire_ht: 1000, remise_montant: 0, remise_percent: 10, total_ht: 9000,
  };

  it('entre en stock au coût net des deux remises, TVA comprise', () => {
    const r = valoriserReception(
      { remise_montant: 0, remise_percent: 5, tva_percent: 18 },
      [ligne],
      { depot_id: 'd1', reference: '', lignes: [{ ligne_id: 'l1', quantite_recue: 10 }] },
    );
    // 1000 − 10 % = 900 ; − 5 % = 855 ; + 18 % = 1008.9
    expect(r.lignes[0]?.cout_unitaire).toBe(1008.9);
    expect(r.total_ttc).toBe(10089);
  });

  it('ignore la remise de ligne quand elle est nulle', () => {
    const r = valoriserReception(
      { remise_montant: 0, remise_percent: 0, tva_percent: 0 },
      [{ ...ligne, remise_percent: 0 }],
      { depot_id: 'd1', reference: '', lignes: [{ ligne_id: 'l1', quantite_recue: 4 }] },
    );
    expect(r.lignes[0]?.cout_unitaire).toBe(1000);
    expect(r.total_ttc).toBe(4000);
  });
});
