import { describe, expect, it } from 'vitest';
import { perimetreJournalVentes, recapJournalVentes, type LigneJournalVente } from './journal';

const vente = (over: Partial<LigneJournalVente> = {}): LigneJournalVente => ({
  total_ttc: 10000, montant_percu: 10000, monnaie: 0, reste_a_payer: 0, statut: 'VALIDEE', mode_paiement: 'ESPECES', ...over,
});

describe('recapJournalVentes', () => {
  it('ne compte pas la monnaie rendue dans l’encaissement', () => {
    const r = recapJournalVentes([vente({ total_ttc: 9000, montant_percu: 10000, monnaie: 1000 })]);
    expect(r.encaisse).toBe(9000);
    expect(r.chiffre_affaires).toBe(9000);
  });

  it('écarte les ventes annulées de tous les totaux, mais les compte', () => {
    const r = recapJournalVentes([vente(), vente({ statut: 'ANNULEE' })]);
    expect(r).toMatchObject({ nombre: 1, annulees: 1, chiffre_affaires: 10000, encaisse: 10000 });
  });

  it('sépare ce qui reste dû et ce qui attend la validation', () => {
    const r = recapJournalVentes([
      vente({ statut: 'EN_ATTENTE', montant_percu: 4000, reste_a_payer: 6000, mode_paiement: 'CREDIT' }),
      vente({ statut: 'VALIDEE' }),
    ]);
    expect(r.credit).toBe(6000);
    expect(r.en_attente).toBe(1);
  });

  it('ventile l’encaissement par mode de paiement', () => {
    const r = recapJournalVentes([
      vente({ mode_paiement: 'ESPECES', montant_percu: 5000, total_ttc: 5000 }),
      vente({ mode_paiement: 'MOBILE_MONEY', montant_percu: 3000, total_ttc: 3000 }),
      vente({ mode_paiement: 'ESPECES', montant_percu: 2000, total_ttc: 2000 }),
    ]);
    expect(r.par_mode).toEqual([{ mode: 'ESPECES', montant: 7000 }, { mode: 'MOBILE_MONEY', montant: 3000 }]);
  });

  it('tient debout sur un journal vide', () => {
    expect(recapJournalVentes([])).toMatchObject({ nombre: 0, chiffre_affaires: 0, encaisse: 0, credit: 0, par_mode: [] });
  });
});

describe('perimetreJournalVentes', () => {
  it('dit « journée du » quand les deux dates sont la même', () => {
    expect(perimetreJournalVentes({ dateDebut: '2026-10-18', dateFin: '2026-10-18' })).toBe('journée du 18/10/2026 · toutes caisses');
  });

  // Le montant est un filtre comme un autre : une liste partielle doit dire
  // sur quoi elle porte, sinon elle se lit comme la journée entière.
  it('écrit le montant cherché', () => {
    const perimetre = perimetreJournalVentes({ dateDebut: '2026-10-18', dateFin: '2026-10-18', montantTtc: 11800 });
    expect(perimetre).toContain('montant');
    expect(perimetre).toContain('11');
    expect(perimetreJournalVentes({ dateDebut: '2026-10-18', dateFin: '2026-10-18', montantTtc: 0 })).not.toContain('montant');
  });

  it('écrit la période et les filtres retenus', () => {
    expect(perimetreJournalVentes({ dateDebut: '2026-10-01', dateFin: '2026-10-18', caisseNom: 'Caisse principale', statutLabel: 'Annulée', recherche: ' KONÉ ' }))
      .toBe('du 01/10/2026 au 18/10/2026 · caisse « Caisse principale » · statut « Annulée » · recherche « KONÉ »');
  });
});
