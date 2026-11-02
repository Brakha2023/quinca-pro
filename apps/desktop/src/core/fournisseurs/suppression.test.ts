import { describe, expect, it } from 'vitest';
import { AUCUN_USAGE_FOURNISSEUR, motifNonSupprimableFournisseur, resumeUsagesFournisseur, usagesFournisseur } from './suppression';

const fiche = { code: 'FOU-001', raison_sociale: 'SOCIMAT CI', solde_initial: 0, cumul_factures: 0, cumul_reglements: 0 };

describe('motifNonSupprimableFournisseur', () => {
  it('laisse passer une fiche jamais utilisée au compte vierge', () => {
    expect(motifNonSupprimableFournisseur(fiche, AUCUN_USAGE_FOURNISSEUR)).toBeNull();
  });

  it('retient un fournisseur qui a livré, même si la base accepterait l’effacement', () => {
    // `mouvements_stock.fournisseur_id` s'efface en silence (`on delete set null`) :
    // la provenance de la marchandise disparaîtrait sans que rien ne proteste.
    const motif = motifNonSupprimableFournisseur(fiche, usagesFournisseur({ entrees: 12 }));
    expect(motif).toContain('12 entrée(s) en stock à son nom');
    expect(motif).toContain('Désactivez-le');
  });

  it('retient une commande ou un règlement', () => {
    expect(resumeUsagesFournisseur(usagesFournisseur({ commandes: 2, reglements: 1 })))
      .toEqual(['2 commande(s) ou achat(s)', '1 règlement(s)']);
  });

  it('refuse un compte qui porte de l’argent', () => {
    expect(motifNonSupprimableFournisseur({ ...fiche, solde_initial: -40_000 }, AUCUN_USAGE_FOURNISSEUR)).toContain('compte mouvementé');
  });
});
