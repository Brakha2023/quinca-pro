import { describe, expect, it } from 'vitest';
import { composerRelanceClient, construireReleveClient, lettrerVersements } from './compte';

describe('construireReleveClient', () => {
  it('enchaîne solde initial, factures et règlements, avec disponibilité (avoir)', () => {
    const releve = construireReleveClient(
      { solde_initial: 10000, date_effet_solde: '2026-01-01' },
      [{ numero: 'C01-1', date_vente: '2026-02-01', total_ttc: 50000, statut: 'EN_ATTENTE' }, { numero: 'C01-9', date_vente: '2026-02-05', total_ttc: 999, statut: 'ANNULEE' }],
      [{ numero: 'REG-1', date_reglement: '2026-02-10', montant: 70000, type_reglement: 'ESPECES', vente_id: null }],
    );
    expect(releve.map((l) => [l.piece, l.facture, l.reglement, l.solde, l.disponibilite])).toEqual([['', 0, 0, 10000, 0], ['C01-1', 50000, 0, 60000, 0], ['REG-1', 0, 70000, -10000, 10000]]);
    expect(releve[2].designation).toBe('Avance payée (Espèces)');
  });
});

describe('lettrerVersements', () => {
  it('consomme les avances en FIFO par la part à crédit des ventes suivantes', () => {
    const versements = lettrerVersements(
      [
        { id: 'a1', date_reglement: '2026-01-01', montant: 40000, vente_id: null },
        { id: 'a2', date_reglement: '2026-01-05', montant: 10000, vente_id: null },
        { id: 'b1', date_reglement: '2026-01-10', montant: 5000, vente_id: 'v1' },
      ],
      [{ id: 'v1', date_vente: '2026-01-10', total_ttc: 47000, statut: 'EN_ATTENTE' }],
    );
    // v1 : 47 000 dont 5 000 réglés directement → 42 000 à couvrir : a1 épuisée (40 000), a2 entamée (2 000).
    expect(versements.find((v) => v.reglement_id === 'a1')).toMatchObject({ nature: 'AVANCE_PAYEE', utilise: 40000, disponibilite: 0 });
    expect(versements.find((v) => v.reglement_id === 'a2')).toMatchObject({ utilise: 2000, disponibilite: 8000 });
    expect(versements.find((v) => v.reglement_id === 'b1')).toMatchObject({ nature: 'BON_PAYE', utilise: 5000, disponibilite: 0 });
  });
});

describe('composerRelanceClient', () => {
  it('liste les factures impayées avec le retard selon la période de règlement', () => {
    const { objet, corps } = composerRelanceClient(
      { filiale: { nom: 'Filiale Abidjan' }, client: { raison_sociale: 'ABDOUL', civilite: 'M.', contact: null, solde_actuel: 35000, periode_reglement: 'J30' },
        facturesImpayees: [{ numero: 'C01-20260801-AB12', date_vente: '2026-08-01T10:00:00Z', reste_a_payer: 35000 }], signataire: 'Awa Koné', aujourdhui: new Date('2026-09-18T12:00:00Z') },
      (n) => `${n} F`, (iso) => iso ? iso.slice(0, 10) : '',
    );
    expect(objet).toContain('35000 F');
    expect(corps).toContain('Bonjour M. ABDOUL');
    expect(corps).toContain('C01-20260801-AB12 du 2026-08-01 — reste dû 35000 F (échue depuis 18 jours)');
  });
});
