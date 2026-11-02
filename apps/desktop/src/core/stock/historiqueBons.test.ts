import { describe, expect, it } from 'vitest';
import {
  TYPES_BON_ENTREE,
  TYPES_BON_INVENTAIRE,
  TYPES_BON_SORTIE,
  TYPES_BON_TRANSFERT,
  recapBons,
  resumeBon,
  type BonStockRow,
} from './historiqueBons';

const ligne = (over: Partial<BonStockRow> = {}): BonStockRow => ({
  reference: 'ENT-2026-0007',
  date: '2026-10-13T08:00:00.000Z',
  type: 'ENTREE_ACHAT',
  depot_nom: 'Principal',
  depot_destination_nom: null,
  fournisseur_nom: 'SOCIMAT CI',
  date_livraison: null,
  remise: 0,
  motif: 'BL 42',
  utilisateur_nom: 'Koné',
  utilisateur_prenom: 'Awa',
  nombre_lignes: 3,
  quantite: 30,
  valeur: 135_000,
  lignes_valorisees: 3,
  articles: 'Ciment 50kg, Fer à béton',
  ...over,
});

describe('familles de bons', () => {
  it('laissent les ventes et les productions hors des onglets de stock', () => {
    const tous = [...TYPES_BON_ENTREE, ...TYPES_BON_SORTIE, ...TYPES_BON_TRANSFERT, ...TYPES_BON_INVENTAIRE];
    expect(tous).not.toContain('SORTIE_VENTE');
    expect(tous).not.toContain('SORTIE_PRODUCTION');
    expect(tous).not.toContain('ENTREE_PRODUCTION');
  });

  it('classent la casse avec les sorties et le retour client avec les entrées', () => {
    expect(TYPES_BON_SORTIE).toContain('CASSE');
    expect(TYPES_BON_ENTREE).toContain('RETOUR_CLIENT');
  });
});

describe('resumeBon', () => {
  it('nomme la nature du bon et recompose l’opérateur', () => {
    const bon = resumeBon(ligne());
    expect(bon.libelle).toBe('Entrée achat');
    expect(bon.utilisateur).toBe('Awa Koné');
    expect(bon.valeur).toBe(135_000);
  });

  it('ne valorise pas un bon dont aucune ligne ne porte de coût', () => {
    const bon = resumeBon(ligne({ type: 'CASSE', valeur: 0, lignes_valorisees: 0 }));
    expect(bon.valeur).toBeNull();
  });

  it('garde le dépôt d’arrivée d’un transfert', () => {
    const bon = resumeBon(ligne({ type: 'TRANSFERT_SORTIE', depot_nom: 'Principal', depot_destination_nom: 'Chantier' }));
    expect(bon.depot).toBe('Principal');
    expect(bon.depot_destination).toBe('Chantier');
  });

  it('garde le signe de l’écart d’un inventaire', () => {
    const bon = resumeBon(ligne({ type: 'INVENTAIRE', quantite: -4, valeur: 0, lignes_valorisees: 0 }));
    expect(bon.quantite).toBe(-4);
    expect(bon.libelle).toBe('Inventaire');
  });

  it('rend la livraison et la remise d’une entrée', () => {
    const bon = resumeBon(ligne({ date_livraison: '2026-10-12T18:30:00.000Z', remise: 5000 }));
    expect(bon.date_livraison).toBe('2026-10-12T18:30:00.000Z');
    expect(bon.remise).toBe(5000);
    // Une livraison non datée ne vaut pas chaîne vide : c'est la date du bon qui fait foi.
    expect(resumeBon(ligne({ date_livraison: '' })).date_livraison).toBeNull();
  });

  it('survit à une ligne sans rien : la base peut rendre des colonnes nulles', () => {
    const bon = resumeBon({
      reference: null, date: null, type: null, depot_nom: null, depot_destination_nom: null,
      fournisseur_nom: null, date_livraison: null, remise: null, motif: null, utilisateur_nom: null, utilisateur_prenom: null,
      nombre_lignes: null, quantite: null, valeur: null, lignes_valorisees: null, articles: null,
    });
    expect(bon.reference).toBe('');
    expect(bon.nombre_lignes).toBe(0);
    expect(bon.utilisateur).toBeNull();
    expect(bon.valeur).toBeNull();
  });
});

describe('recapBons', () => {
  it('compte les bons, leurs lignes, et n’additionne que ce qui est valorisé', () => {
    const recap = recapBons([
      resumeBon(ligne()),
      resumeBon(ligne({ reference: 'CAS-2026-0001', valeur: 0, lignes_valorisees: 0, nombre_lignes: 1 })),
    ]);
    expect(recap).toEqual({ nombre: 2, lignes: 4, valeur: 135_000, remise: 0 });
  });

  it('cumule les remises obtenues sur la période', () => {
    const recap = recapBons([resumeBon(ligne({ remise: 5000 })), resumeBon(ligne({ reference: 'ENT-2', remise: 1500 }))]);
    expect(recap.remise).toBe(6500);
  });

  it('rend un récapitulatif vide sans bon', () => {
    expect(recapBons([])).toEqual({ nombre: 0, lignes: 0, valeur: 0, remise: 0 });
  });
});
