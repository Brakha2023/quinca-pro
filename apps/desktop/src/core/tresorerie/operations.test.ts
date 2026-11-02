import { describe, expect, it } from 'vitest';
import { filtrerOperations, perimetreOperations, recapOperations, type LigneOperation } from './operations';

const ligne = (p: Partial<LigneOperation> & { id: string; montant: number }): LigneOperation => ({
  date: '2026-11-02T10:00:00Z',
  type: 'DEPENSE',
  categorie: 'TRANSPORT',
  categorie_libelle: 'Transport',
  description: '',
  piece: '',
  caisse: 'Caisse principale',
  operateur: 'Awa Traoré',
  ...p,
});

const lignes = [
  ligne({ id: '1', montant: 12_000, description: 'Taxi livraison Yopougon', piece: 'DEP-001' }),
  ligne({ id: '2', montant: 8_000, categorie: 'REPAS', categorie_libelle: 'Repas', description: 'Déjeuner équipe' }),
  ligne({ id: '3', montant: 30_000, description: 'Camion sable' }),
  ligne({ id: '4', montant: 50_000, type: 'RECETTE', categorie: 'APPORT', categorie_libelle: 'Apport de fonds' }),
];

describe('filtrerOperations', () => {
  it('ne retient qu’une catégorie', () => {
    expect(filtrerOperations(lignes, { categorie: 'TRANSPORT' }).map((l) => l.id)).toEqual(['1', '3']);
  });

  it('cherche dans la description, la pièce, la caisse, la catégorie et l’opérateur', () => {
    expect(filtrerOperations(lignes, { recherche: 'yopougon' }).map((l) => l.id)).toEqual(['1']);
    expect(filtrerOperations(lignes, { recherche: 'DEP-001' }).map((l) => l.id)).toEqual(['1']);
    expect(filtrerOperations(lignes, { recherche: 'repas' }).map((l) => l.id)).toEqual(['2']);
    expect(filtrerOperations(lignes, { recherche: 'awa' })).toHaveLength(4);
  });

  it('rend tout sans filtre', () => {
    expect(filtrerOperations(lignes)).toHaveLength(4);
  });
});

describe('recapOperations', () => {
  it('tient les deux sens séparément', () => {
    const recap = recapOperations(lignes);
    expect(recap.depenses).toBe(50_000);
    expect(recap.recettes).toBe(50_000);
    expect(recap.net).toBe(0);
    // Le volume manipulé, celui qu'on rapproche d'une liasse de pièces.
    expect(recap.total).toBe(100_000);
    expect(recap.nombre).toBe(4);
  });

  it('ventile par catégorie, la plus lourde d’abord', () => {
    const { ventilation } = recapOperations(lignes);
    expect(ventilation.map((v) => [v.categorie, v.montant, v.nombre])).toEqual([
      ['APPORT', 50_000, 1],
      ['TRANSPORT', 42_000, 2],
      ['REPAS', 8_000, 1],
    ]);
  });

  it('rapporte chaque catégorie au total retenu', () => {
    const { ventilation } = recapOperations(filtrerOperations(lignes, { categorie: 'TRANSPORT' }));
    expect(ventilation).toEqual([{ categorie: 'TRANSPORT', libelle: 'Transport', nombre: 2, montant: 42_000, part: 100 }]);
  });

  it('ne divise pas par zéro sur une liste vide', () => {
    expect(recapOperations([])).toEqual({ nombre: 0, recettes: 0, depenses: 0, net: 0, total: 0, ventilation: [] });
  });
});

describe('perimetreOperations', () => {
  it('écrit la période, la caisse et les filtres', () => {
    expect(perimetreOperations({ debut: '01/11/2026', fin: '02/11/2026', caisseNom: 'Caisse principale', categorieLibelle: 'Transport', recherche: ' taxi ' }))
      .toBe('du 01/11/2026 au 02/11/2026 · caisse « Caisse principale » · catégorie « Transport » · recherche « taxi »');
  });

  it('dit « toutes les caisses » quand aucune n’est choisie', () => {
    expect(perimetreOperations({ debut: '01/11/2026', fin: '02/11/2026' })).toBe('du 01/11/2026 au 02/11/2026 · toutes les caisses');
  });
});
