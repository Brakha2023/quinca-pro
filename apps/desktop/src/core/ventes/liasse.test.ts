import { describe, expect, it } from 'vitest';
import {
  COPIES_FACTURE, feuillesAImprimer, lignesBonLivraison, recapBonLivraison, sortieParDefaut,
} from './liasse';
import type { LignePanier } from './panier';

const ligne = (over: Partial<LignePanier> = {}): LignePanier => ({
  article_id: 'a1', code: 'CIM-50', designation: 'Ciment 50 kg', unite: 'SAC',
  prix_unitaire_ttc: 5900, tva_percent: 0, quantite: 2, remise_percent: 0, ...over,
});

describe('feuillesAImprimer', () => {
  it('sort la facture en deux exemplaires, nommés', () => {
    const feuilles = feuillesAImprimer('FACTURE');
    expect(feuilles).toHaveLength(COPIES_FACTURE);
    expect(feuilles.map((f) => f.exemplaire)).toEqual(['Exemplaire client', 'Exemplaire maison']);
    expect(feuilles.every((f) => f.piece === 'FACTURE')).toBe(true);
  });

  // Le bon vient après les factures : il part avec la marchandise, pas avec le client.
  it('ajoute le bon de livraison en dernier', () => {
    const feuilles = feuillesAImprimer('FACTURE_BL');
    expect(feuilles).toHaveLength(COPIES_FACTURE + 1);
    expect(feuilles.at(-1)).toEqual({ piece: 'BON_LIVRAISON', exemplaire: null });
  });

  // Le ticket a sa propre mise en page, sur un autre papier.
  it('ne met rien dans la liasse pour un ticket', () => {
    expect(feuillesAImprimer('TICKET')).toEqual([]);
  });
});

describe('sortieParDefaut', () => {
  it('suit le format du poste', () => {
    expect(sortieParDefaut('TICKET', false)).toBe('TICKET');
    expect(sortieParDefaut('A4', false)).toBe('FACTURE');
  });

  it('propose le bon quand une livraison a été demandée', () => {
    expect(sortieParDefaut('A4', true)).toBe('FACTURE_BL');
  });

  // Un poste réglé sur le ticket garde son ticket : le bon s'imprime d'un clic.
  it('ne force pas l’A4 sur un poste à ticket', () => {
    expect(sortieParDefaut('TICKET', true)).toBe('TICKET');
  });
});

describe('bon de livraison', () => {
  it('porte la marchandise et son dépôt, sans prix', () => {
    const lignes = lignesBonLivraison([ligne(), ligne({ code: 'FER-12', unite: 'BARRE', quantite: 5 })], 'Magasin central');
    expect(lignes[0]).toEqual({ code: 'CIM-50', designation: 'Ciment 50 kg', quantite: 2, unite: 'SAC', depot: 'Magasin central' });
    expect(Object.keys(lignes[1]!)).not.toContain('prix_unitaire_ht');
  });

  it('récapitule ce qu’il y a à charger', () => {
    const lignes = lignesBonLivraison([ligne(), ligne({ code: 'FER-12', quantite: 5 })], 'Magasin');
    expect(recapBonLivraison(lignes)).toEqual({ lignes: 2, articles: 7 });
  });
});
