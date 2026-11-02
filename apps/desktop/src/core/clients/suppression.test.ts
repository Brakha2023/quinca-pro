import { describe, expect, it } from 'vitest';
import { AUCUN_USAGE_CLIENT, motifNonSupprimableClient, resumeUsagesClient, usagesClient } from './suppression';

const fiche = { code: 'CLI-001', raison_sociale: 'Entreprise Koffi', solde_initial: 0, cumul_factures: 0, cumul_reglements: 0 };

describe('usagesClient', () => {
  it('complète ce qui n’a pas été compté : une table absente vaut zéro', () => {
    expect(usagesClient({ ventes: 3 })).toEqual({ ...AUCUN_USAGE_CLIENT, ventes: 3 });
  });

  it('dit ce qui retient la fiche, dans l’ordre', () => {
    expect(resumeUsagesClient(usagesClient({ ventes: 2, livraisons: 1 }))).toEqual(['2 vente(s)', '1 livraison(s)']);
    expect(resumeUsagesClient(AUCUN_USAGE_CLIENT)).toEqual([]);
  });
});

describe('motifNonSupprimableClient', () => {
  it('laisse passer une fiche jamais utilisée au compte vierge', () => {
    expect(motifNonSupprimableClient(fiche, AUCUN_USAGE_CLIENT)).toBeNull();
  });

  it('refuse un client qui a vendu, et renvoie vers la mise en sommeil', () => {
    const motif = motifNonSupprimableClient(fiche, usagesClient({ ventes: 4, reglements: 2 }));
    expect(motif).toContain('2 règlement(s)');
    expect(motif).toContain('Désactivez-le');
  });

  it('traite à part le brouillon, la seule attache qui se défait en un geste', () => {
    const motif = motifNonSupprimableClient(fiche, usagesClient({ brouillons: 1 }));
    expect(motif).toContain('brouillon');
    expect(motif).toContain('reprenez-les ou jetez-les');
  });

  it('refuse un compte qui porte de l’argent, même sans pièce sur le poste', () => {
    // Solde d'ouverture repris à la main : l'effacer ferait disparaître une créance.
    expect(motifNonSupprimableClient({ ...fiche, solde_initial: 150_000 }, AUCUN_USAGE_CLIENT)).toContain('compte mouvementé');
    // Les cumuls sont tenus par le serveur : non nuls, des pièces existent ailleurs.
    expect(motifNonSupprimableClient({ ...fiche, cumul_factures: 25_000 }, AUCUN_USAGE_CLIENT)).toContain('compte mouvementé');
    expect(motifNonSupprimableClient({ ...fiche, cumul_reglements: 25_000 }, AUCUN_USAGE_CLIENT)).toContain('compte mouvementé');
  });

  it('nomme la fiche en clair : on efface sur un nom, pas sur un identifiant', () => {
    expect(motifNonSupprimableClient(fiche, usagesClient({ ventes: 1 }))).toContain('« CLI-001 — Entreprise Koffi »');
  });
});
