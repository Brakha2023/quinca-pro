import { describe, expect, it } from 'vitest';
import {
  construireBonTransfert,
  perimetreTransfertsStock,
  recapTransfertsStock,
  roleTransfertStock,
  totauxTransfert,
  transfertAnnulable,
  transfertFilialeStockSchema,
  transfertReceptionnable,
  type LigneTransfertStock,
  type TransfertStockVue,
} from './transfertFiliale';

const ligne = (p: Partial<LigneTransfertStock> = {}): LigneTransfertStock => ({
  id: 'l1', code: 'CIM-50', designation: 'Ciment 50kg', unite: 'SAC',
  quantite: 10, cout_unitaire: 4500, prix_vente: 5500, montant: 45000, ...p,
});

const transfert = (p: Partial<TransfertStockVue> = {}): TransfertStockVue => ({
  id: 't1', numero: 'TSF-A1B-20261018-ZZZZZZ', statut: 'EN_TRANSIT',
  filiale_source_id: 'abj', filiale_destination_id: 'bke',
  filiale_source_nom: 'Abidjan', filiale_destination_nom: 'Bouaké',
  depot_source_nom: 'Principal', depot_destination_nom: null,
  motif: 'Appro.', transporteur: 'Kouassi — 1234 CI',
  nombre_lignes: 1, quantite_totale: 10, valeur_totale: 45000,
  date_envoi: '2026-10-18T08:00:00.000Z', date_reception: null,
  utilisateur_envoi: 'Awa Koné', utilisateur_reception: null, ...p,
});

describe('totauxTransfert', () => {
  it('additionne quantités et valeurs au coût de départ', () => {
    expect(totauxTransfert([ligne(), ligne({ quantite: 3, cout_unitaire: 2000 })])).toEqual({
      nombre_lignes: 2, quantite_totale: 13, valeur_totale: 51000,
    });
  });

  it('vaut zéro sur un bon vide', () => {
    expect(totauxTransfert([])).toEqual({ nombre_lignes: 0, quantite_totale: 0, valeur_totale: 0 });
  });
});

describe('qui peut agir', () => {
  it('reconnaît expéditeur, destinataire et tiers', () => {
    expect(roleTransfertStock(transfert(), 'abj')).toBe('EXPEDITEUR');
    expect(roleTransfertStock(transfert(), 'bke')).toBe('DESTINATAIRE');
    expect(roleTransfertStock(transfert(), 'man')).toBe('TIERS');
  });

  it('seul le destinataire réceptionne, seul l’expéditeur annule', () => {
    expect(transfertReceptionnable(transfert(), 'bke')).toBe(true);
    expect(transfertReceptionnable(transfert(), 'abj')).toBe(false);
    expect(transfertAnnulable(transfert(), 'abj')).toBe(true);
    expect(transfertAnnulable(transfert(), 'bke')).toBe(false);
  });

  it('un bon déjà traité ne se reçoit ni ne s’annule plus', () => {
    const recu = transfert({ statut: 'RECU' });
    expect(transfertReceptionnable(recu, 'bke')).toBe(false);
    expect(transfertAnnulable(recu, 'abj')).toBe(false);
  });
});

describe('recapTransfertsStock', () => {
  it('compte par statut et ignore les annulés dans les valeurs', () => {
    const recap = recapTransfertsStock([
      transfert(),
      transfert({ id: 't2', statut: 'RECU', quantite_totale: 5, valeur_totale: 10000 }),
      transfert({ id: 't3', statut: 'ANNULE', quantite_totale: 99, valeur_totale: 999000 }),
    ]);
    expect(recap).toEqual({
      nombre: 3, en_transit: 1, recus: 1, annules: 1,
      quantite: 15, valeur: 55000, valeur_en_transit: 45000,
    });
  });
});

describe('perimetreTransfertsStock', () => {
  it('écrit les filtres en toutes lettres', () => {
    expect(perimetreTransfertsStock({ sens: 'ENVOIS', debut: '2026-10-01', fin: '2026-10-18', filialeNom: 'Bouaké', statut: 'EN_TRANSIT' }))
      .toBe('Envois seulement · du 2026-10-01 au 2026-10-18 · filiale « Bouaké » · En transit');
  });

  it('dit « toutes périodes » quand rien n’est borné', () => {
    expect(perimetreTransfertsStock({})).toBe('Envois et réceptions · toutes périodes · toutes filiales · tous statuts');
  });
});

describe('construireBonTransfert', () => {
  it('recalcule les totaux depuis les lignes, qui font foi devant le chauffeur', () => {
    // L'en-tête annonce 10 sacs ; les lignes en portent 13. C'est la
    // marchandise qu'on compte au camion, pas le résumé.
    const bon = construireBonTransfert(transfert(), [ligne(), ligne({ id: 'l2', quantite: 3, cout_unitaire: 2000 })]);
    expect(bon.quantite_totale).toBe(13);
    expect(bon.valeur_totale).toBe(51000);
    expect(bon.lignes).toHaveLength(2);
  });

  it('nomme le dépôt d’arrivée seulement quand il est connu', () => {
    expect(construireBonTransfert(transfert(), [ligne()]).depot_destination).toBeNull();
    expect(construireBonTransfert(transfert({ statut: 'RECU', depot_destination_nom: 'Annexe' }), [ligne()]).depot_destination).toBe('Annexe');
  });
});

describe('transfertFilialeStockSchema', () => {
  it('exige une destination, un dépôt de départ et au moins une ligne', () => {
    const vide = transfertFilialeStockSchema.safeParse({ filiale_destination_id: '', depot_source_id: '', lignes: [] });
    expect(vide.success).toBe(false);
    expect(vide.error?.issues.map((i) => i.message)).toContain('Filiale destinataire obligatoire');
  });

  it('refuse une quantité nulle ou négative', () => {
    const r = transfertFilialeStockSchema.safeParse({
      filiale_destination_id: 'bke', depot_source_id: 'd1', lignes: [{ article_id: 'a1', quantite: 0 }],
    });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toBe('Quantité > 0');
  });

  it('accepte un bon complet et met les textes à défaut vides', () => {
    const r = transfertFilialeStockSchema.parse({
      filiale_destination_id: 'bke', depot_source_id: 'd1', lignes: [{ article_id: 'a1', quantite: 2 }],
    });
    expect(r).toMatchObject({ numero: '', motif: '', transporteur: '', lignes: [{ article_id: 'a1', quantite: 2 }] });
  });
});
