import { describe, expect, it } from 'vitest';
import { construireBon, titreBon, type MouvementDuBon } from './bon';

const mvt = (over: Partial<MouvementDuBon> = {}): MouvementDuBon => ({
  id: 'm1',
  type: 'ENTREE_ACHAT',
  article_code: 'CIM-50',
  article_designation: 'Ciment 50kg',
  article_unite: 'SAC',
  depot_nom: 'Principal',
  quantite: 10,
  quantite_avant: 0,
  quantite_apres: 10,
  cout_unitaire: 4500,
  motif: 'BL 42',
  fournisseur_nom: 'SOCIMAT CI',
  utilisateur: 'Awa Koné',
  created_at: '2026-10-13T08:00:00.000Z',
  ...over,
});

describe('titreBon', () => {
  it('nomme le bon selon la nature du mouvement', () => {
    expect(titreBon('ENTREE_ACHAT')).toBe("Bon d'entrée — achat");
    expect(titreBon('CASSE')).toBe('Bon de sortie — casse / perte');
    expect(titreBon('INVENTAIRE')).toBe("Fiche d'inventaire");
  });
});

describe('construireBon', () => {
  it("reprend l'entête et valorise les lignes d'une entrée", () => {
    const bon = construireBon('ENT-20261013-AB12', [mvt(), mvt({ id: 'm2', article_code: 'VIS-50', article_designation: 'Vis 50mm', article_unite: 'BOITE', quantite: 4, cout_unitaire: 2500 })]);
    expect(bon?.titre).toBe("Bon d'entrée — achat");
    expect(bon?.depot).toBe('Principal');
    expect(bon?.fournisseur).toBe('SOCIMAT CI');
    expect(bon?.motif).toBe('BL 42');
    expect(bon?.lignes).toHaveLength(2);
    expect(bon?.total_valeur).toBe(55000);
    expect(bon?.valorise).toBe(true);
  });

  it('signe négativement les quantités sorties', () => {
    const bon = construireBon('CAS-1', [mvt({ type: 'CASSE', quantite: 3, cout_unitaire: null, quantite_avant: 10, quantite_apres: 7 })]);
    expect(bon?.lignes[0]?.quantite).toBe(-3);
    expect(bon?.lignes[0]?.valeur).toBeNull();
    expect(bon?.valorise).toBe(false);
    expect(bon?.total_valeur).toBe(0);
  });

  it('ne compte qu’une fois les articles d’un transfert et nomme les deux dépôts', () => {
    const bon = construireBon('TRF-1', [
      mvt({ id: 's', type: 'TRANSFERT_SORTIE', depot_nom: 'Principal', quantite: 5, created_at: '2026-10-13T09:00:00.000Z' }),
      mvt({ id: 'e', type: 'TRANSFERT_ENTREE', depot_nom: 'Annexe', quantite: 5, created_at: '2026-10-13T09:00:01.000Z' }),
    ]);
    expect(bon?.lignes).toHaveLength(1);
    expect(bon?.lignes[0]?.quantite).toBe(-5);
    expect(bon?.depot).toBe('Principal');
    expect(bon?.depot_destination).toBe('Annexe');
  });

  it("garde l'écart d'un inventaire, qui n'est ni une entrée ni une sortie", () => {
    const bon = construireBon('INV-1', [mvt({ type: 'INVENTAIRE', quantite: 2, quantite_avant: 150, quantite_apres: 148, cout_unitaire: null })]);
    expect(bon?.lignes[0]?.quantite).toBe(2);
    expect(bon?.lignes[0]?.quantite_avant).toBe(150);
    expect(bon?.lignes[0]?.quantite_apres).toBe(148);
  });

  it('rend null sans mouvement', () => {
    expect(construireBon('ENT-0', [])).toBeNull();
  });
});
