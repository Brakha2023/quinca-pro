import { describe, expect, it } from 'vitest';
import { construireFactureAchat, documentsCommande, estFacturable, type EnteteFacture } from './factureAchat';
import type { Fournisseur, LigneCommandeFournisseur } from './fournisseur';

const ligne = (p: Partial<LigneCommandeFournisseur> = {}): LigneCommandeFournisseur => ({
  id: 'l1', commande_id: 'c1', article_id: 'a1', code_article: 'TOLL-7',
  designation: 'Feuille de tôle 7/10', unite: 'PIECE',
  quantite: 10, quantite_recue: 10, prix_unitaire_ht: 4800, remise_percent: 0, total_ht: 48000,
  ...p,
});

const entete = (p: Partial<EnteteFacture['commande']> = {}): EnteteFacture => ({
  commande: {
    numero: 'ACH-A1B-20261018-ZZZZZZ',
    date_commande: '2026-10-07T15:41:00.000Z',
    date_reception: '2026-10-07T15:41:00.000Z',
    type: 'COMMANDE',
    remise_percent: 0,
    tva_percent: 0,
    montant_paye: 0,
    reste_a_payer: 48000,
    notes: null,
    ...p,
  },
  depot: 'Dépôt central',
  operateur: 'Awa Koné',
  fournisseur_nom: 'GLOBAL EXIM NOUVEAU',
});

const fournisseur: Pick<Fournisseur, 'raison_sociale' | 'numero_rc' | 'numero_cc' | 'adresse' | 'interlocuteur' | 'mobile_interlocuteur' | 'telephone'> = {
  raison_sociale: 'GLOBAL EXIM NOUVEAU', numero_rc: 'RC-2026-77', numero_cc: 'CC-99',
  adresse: 'Zone 4, Abidjan', interlocuteur: 'M. Diallo', mobile_interlocuteur: '07 00 00 00 00', telephone: '27 32 79 50 90',
};

describe('estFacturable', () => {
  it('attend qu’une marchandise soit arrivée', () => {
    expect(estFacturable({ total_recu_ttc: 0, statut: 'ENVOYEE' })).toBe(false);
    expect(estFacturable({ total_recu_ttc: 48000, statut: 'PARTIELLE' })).toBe(true);
  });

  it('ne facture pas une pièce annulée', () => {
    expect(estFacturable({ total_recu_ttc: 48000, statut: 'ANNULEE' })).toBe(false);
  });
});

describe('documentsCommande', () => {
  it('un achat direct ne produit qu’une facture', () => {
    expect(documentsCommande({ type: 'COMMANDE', total_recu_ttc: 48000, statut: 'LIVREE' })).toEqual(['FACTURE']);
  });

  it('un bon de commande produit son bon, puis sa facture à la réception', () => {
    expect(documentsCommande({ type: 'BON_COMMANDE', total_recu_ttc: 0, statut: 'ENVOYEE' })).toEqual(['BON']);
    expect(documentsCommande({ type: 'BON_COMMANDE', total_recu_ttc: 10, statut: 'PARTIELLE' })).toEqual(['BON', 'FACTURE']);
  });
});

describe('construireFactureAchat', () => {
  it('reprend le fournisseur, le dépôt et la nature de la pièce', () => {
    const f = construireFactureAchat(entete(), [ligne()], fournisseur);
    expect(f).toMatchObject({ numero: 'ACH-A1B-20261018-ZZZZZZ', depot: 'Dépôt central', operateur: 'Awa Koné', nature: 'ACHAT' });
    expect(f.fournisseur).toEqual({
      raison_sociale: 'GLOBAL EXIM NOUVEAU', numero_rc: 'RC-2026-77', numero_cc: 'CC-99',
      adresse: 'Zone 4, Abidjan', contact: 'M. Diallo · 07 00 00 00 00',
    });
  });

  it('ne facture que les quantités reçues', () => {
    // 10 commandés, 4 reçus : la facture porte 4 × 4 800, pas 10.
    const f = construireFactureAchat(entete({ reste_a_payer: 19200 }), [ligne({ quantite: 10, quantite_recue: 4 })], fournisseur);
    expect(f.lignes).toHaveLength(1);
    expect(f.lignes[0]).toMatchObject({ quantite: 4, total_ht: 19200 });
    expect(f.totaux.net_a_payer).toBe(19200);
    expect(f.partielle).toBe(true);
  });

  it('laisse de côté une ligne commandée mais pas encore livrée', () => {
    const f = construireFactureAchat(entete(), [ligne(), ligne({ id: 'l2', code_article: 'LAM070', quantite_recue: 0 })], fournisseur);
    expect(f.lignes.map((l) => l.code)).toEqual(['TOLL-7']);
  });

  it('applique remise de ligne, remise globale puis TVA, dans cet ordre', () => {
    // 10 × 4 800 = 48 000 ; −10 % de ligne = 43 200 ; −5 % sur le bon = 41 040 ; TVA 18 % = 7 387,20.
    const f = construireFactureAchat(
      entete({ remise_percent: 5, tva_percent: 18 }),
      [ligne({ remise_percent: 10 })],
      fournisseur,
    );
    expect(f.totaux).toMatchObject({ brut_ht: 48000, remise_lignes: 4800, remise_globale: 2160, remise: 6960, net_ht: 41040, tva: 7387.2 });
    expect(f.totaux.net_a_payer).toBe(48427.2);
  });

  it('écrit le net à payer en toutes lettres', () => {
    const f = construireFactureAchat(entete(), [ligne({ quantite: 1984, quantite_recue: 1984, prix_unitaire_ht: 4800 })], fournisseur);
    expect(f.totaux.net_a_payer).toBe(9523200);
    expect(f.montant_en_lettres).toBe('neuf millions cinq cent vingt-trois mille deux cents francs CFA');
  });

  it('distingue une facture comptant d’une facture à crédit', () => {
    expect(construireFactureAchat(entete({ montant_paye: 48000, reste_a_payer: 0 }), [ligne()], fournisseur).reglement).toBe('COMPTANT');
    expect(construireFactureAchat(entete(), [ligne()], fournisseur).reglement).toBe('CREDIT');
  });

  it('porte la date de la réception, pas celle de la commande', () => {
    const f = construireFactureAchat(entete({ type: 'BON_COMMANDE', date_commande: '2026-10-01T08:00:00.000Z', date_reception: '2026-10-07T15:41:00.000Z' }), [ligne()], fournisseur);
    expect(f.date).toBe('2026-10-07T15:41:00.000Z');
    expect(f.nature).toBe('RECEPTION');
  });

  it('garde le nom porté par la pièce tant que la fiche fournisseur n’est pas là', () => {
    const f = construireFactureAchat(entete(), [ligne()], null);
    expect(f.fournisseur).toEqual({ raison_sociale: 'GLOBAL EXIM NOUVEAU', numero_rc: null, numero_cc: null, adresse: null, contact: null });
  });

  it('tient debout sans fournisseur du tout', () => {
    expect(construireFactureAchat({ ...entete(), fournisseur_nom: null }, [ligne()], null).fournisseur.raison_sociale).toBe('—');
  });
});
