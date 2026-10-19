import { describe, expect, it } from 'vitest';
import {
  SECTIONS_HISTORIQUE,
  TYPES_MOUVEMENT_SECTION,
  descriptionSection,
  estSectionHistorique,
  filtresEnClair,
  perimetreHistorique,
  recapHistorique,
  type PieceHistorique,
} from './historiques';

const piece = (p: Partial<PieceHistorique> = {}): PieceHistorique => ({
  id: 'p1', reference: 'ENT-A1B-20261019-ZZZZZZ', date: '2026-10-19T08:00:00.000Z',
  tiers: 'SOCIMAT CI', depot: 'Principal', lignes: 2, quantite: 110, montant: 450000,
  statut: null, utilisateur: 'Awa Koné', ...p,
});

describe('sections', () => {
  it('couvre les sept historiques du menu', () => {
    expect(SECTIONS_HISTORIQUE.map((s) => s.id)).toEqual([
      'ventes', 'commandes-fournisseurs', 'entrees', 'transferts', 'productions', 'destockages', 'inventaires',
    ]);
  });

  it('nomme la colonne des tiers et celle des montants section par section', () => {
    expect(descriptionSection('ventes')).toMatchObject({ tiers: 'Client', montant: 'Total TTC' });
    expect(descriptionSection('transferts')).toMatchObject({ tiers: 'Dépôt de départ', montant: 'Valeur transférée' });
  });

  it('reconnaît une section du menu, et rien d’autre', () => {
    expect(estSectionHistorique('inventaires')).toBe(true);
    expect(estSectionHistorique('deconditionnements')).toBe(false);
    expect(estSectionHistorique(undefined)).toBe(false);
  });

  it('retombe sur la première section si l’identifiant est inconnu', () => {
    expect(descriptionSection('inconnue' as never).id).toBe('ventes');
  });
});

describe('TYPES_MOUVEMENT_SECTION', () => {
  it('un transfert ne retient que sa sortie : l’entrée porte la même référence', () => {
    expect(TYPES_MOUVEMENT_SECTION.transferts).toEqual(['TRANSFERT_SORTIE']);
  });

  it('les déstockages réunissent le déstockage et la casse', () => {
    expect(TYPES_MOUVEMENT_SECTION.destockages).toEqual(['SORTIE_DESTOCKAGE', 'CASSE']);
  });

  it('ne concerne que les sections tirées du journal des mouvements', () => {
    expect(TYPES_MOUVEMENT_SECTION.ventes).toBeUndefined();
    expect(TYPES_MOUVEMENT_SECTION.productions).toBeUndefined();
  });
});

describe('recapHistorique', () => {
  it('totalise les pièces, leurs lignes, leurs quantités et leurs montants', () => {
    expect(recapHistorique([piece(), piece({ id: 'p2', lignes: 1, quantite: 5, montant: 22500 })]))
      .toEqual({ pieces: 2, lignes: 3, quantite: 115, montant: 472500 });
  });

  it('vaut zéro sur une période vide', () => {
    expect(recapHistorique([])).toEqual({ pieces: 0, lignes: 0, quantite: 0, montant: 0 });
  });
});

describe('perimetreHistorique', () => {
  it('écrit la section, la période et les filtres retenus', () => {
    expect(perimetreHistorique('entrees', { debut: '01/10/2026', fin: '19/10/2026', depotNom: 'Principal', recherche: 'BL-2' }))
      .toBe('Entrées en stock (achat) · du 01/10/2026 au 19/10/2026 · dépôt « Principal » · recherche « BL-2 »');
  });

  it('donne les filtres seuls à l’écran, qui affiche déjà la section', () => {
    expect(filtresEnClair({ debut: '01/10/2026', fin: '19/10/2026', depotNom: 'Principal' }))
      .toBe('du 01/10/2026 au 19/10/2026 · dépôt « Principal »');
  });

  it('se tait sur les filtres absents', () => {
    expect(perimetreHistorique('ventes', { debut: '01/10/2026', fin: '19/10/2026' }))
      .toBe('Ventes · du 01/10/2026 au 19/10/2026');
  });
});
