import { describe, expect, it } from 'vitest';
import { construireJournalCaisse, soldeOuverture, type MouvementAffiche } from './journal';

const mouvement = (id: string, date: string, type: 'RECETTE' | 'DEPENSE', montant: number): MouvementAffiche => ({
  id, date_operation: date, type, montant, categorie: 'VENTE', description: null, reference: `PIECE-${id}`,
});

describe('soldeOuverture', () => {
  it('remonte le temps depuis le solde actuel', () => {
    // 120 000 aujourd'hui, après +50 000 et −20 000 : la période a ouvert à 90 000.
    expect(soldeOuverture(120_000, [mouvement('1', '2026-10-08T09:00:00Z', 'RECETTE', 50_000), mouvement('2', '2026-10-08T15:00:00Z', 'DEPENSE', 20_000)])).toBe(90_000);
  });

  it('vaut le solde actuel quand rien ne s’est passé', () => {
    expect(soldeOuverture(75_000, [])).toBe(75_000);
  });

  it('accepte une caisse descendue dans le rouge', () => {
    expect(soldeOuverture(-5_000, [mouvement('1', '2026-10-08T09:00:00Z', 'DEPENSE', 10_000)])).toBe(5_000);
  });
});

describe('construireJournalCaisse', () => {
  const mouvements = [
    mouvement('2', '2026-10-08T15:00:00Z', 'DEPENSE', 20_000),
    mouvement('1', '2026-10-08T09:00:00Z', 'RECETTE', 50_000),
    mouvement('3', '2026-10-08T18:00:00Z', 'RECETTE', 5_500),
  ];

  it('classe du plus ancien au plus récent et cumule le solde', () => {
    const journal = construireJournalCaisse(90_000, mouvements);
    expect(journal.lignes.map((l) => l.id)).toEqual(['1', '2', '3']);
    expect(journal.lignes.map((l) => l.solde)).toEqual([140_000, 120_000, 125_500]);
  });

  it('totalise les deux colonnes et clôture sur l’ouverture', () => {
    const journal = construireJournalCaisse(90_000, mouvements);
    expect(journal.totalRecettes).toBe(55_500);
    expect(journal.totalDepenses).toBe(20_000);
    expect(journal.cloture).toBe(125_500);
    expect(journal.cloture).toBe(journal.lignes.at(-1)!.solde);
  });

  it('rend une période vide sans ligne, clôture = ouverture', () => {
    const journal = construireJournalCaisse(42_000, []);
    expect(journal.lignes).toEqual([]);
    expect(journal.cloture).toBe(42_000);
  });

  it('arrondit au franc : pas de centime qui traîne dans le solde', () => {
    const journal = construireJournalCaisse(0, [mouvement('1', '2026-10-08T09:00:00Z', 'RECETTE', 949.05)]);
    expect(journal.lignes[0]!.solde).toBe(949);
    expect(journal.cloture).toBe(949);
  });
});
