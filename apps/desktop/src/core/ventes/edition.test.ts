import { describe, expect, it } from 'vitest';
import { lignesPanierDepuisVente, remiseDepuisVente, venteModifiable } from './edition';
import { calculerTotaux, type LignePanier } from './panier';
import type { LigneVente } from './vente';

const ligneVente = (over: Partial<LigneVente> = {}): LigneVente => ({
  id: 'l1', vente_id: 'v1', article_id: 'a1', code_article: 'CIM-50', designation: 'Ciment 50 kg',
  quantite: 2, prix_unitaire_ht: 5000, prix_unitaire_ttc: 5900, remise_percent: 0, tva_percent: 18,
  total_ht: 10000, total_ttc: 11800, depot_id: 'd1', ...over,
});

describe('venteModifiable', () => {
  it('n’ouvre que les ventes en attente', () => {
    expect(venteModifiable('EN_ATTENTE')).toBe(true);
    expect(venteModifiable('VALIDEE')).toBe(false);
    expect(venteModifiable('ANNULEE')).toBe(false);
    expect(venteModifiable(null)).toBe(false);
  });
});

describe('lignesPanierDepuisVente', () => {
  it('rend un panier modifiable, unité reprise de l’article', () => {
    const panier = lignesPanierDepuisVente([ligneVente()], () => 'SAC');
    expect(panier[0]).toEqual({
      article_id: 'a1', code: 'CIM-50', designation: 'Ciment 50 kg', unite: 'SAC',
      prix_unitaire_ttc: 5900, tva_percent: 18, quantite: 2, remise_percent: 0,
    });
  });

  it('se rabat sur « PIECE » quand l’article n’est plus au catalogue', () => {
    expect(lignesPanierDepuisVente([ligneVente()], () => undefined)[0]!.unite).toBe('PIECE');
  });

  // Une ligne sans article ne se remet pas en stock : elle ne peut pas repartir
  // au comptoir non plus.
  it('écarte une ligne qui ne nomme aucun article', () => {
    expect(lignesPanierDepuisVente([ligneVente({ article_id: null })], () => 'SAC')).toEqual([]);
  });
});

describe('remiseDepuisVente', () => {
  const panier: LignePanier[] = [
    { article_id: 'a1', code: 'CIM-50', designation: 'Ciment', unite: 'SAC', prix_unitaire_ttc: 5900, tva_percent: 18, quantite: 2, remise_percent: 0 },
  ];

  it('retrouve la remise telle qu’elle avait été accordée', () => {
    const totaux = calculerTotaux(panier, 1000);
    expect(remiseDepuisVente(panier, totaux.total_ttc)).toBe(1000);
  });

  it('rend zéro quand rien n’a été remisé', () => {
    expect(remiseDepuisVente(panier, calculerTotaux(panier, 0).total_ttc)).toBe(0);
  });

  // Une remise de ligne (reprise d'une proforma) ne doit pas se compter une
  // seconde fois comme remise de vente.
  it('ne compte pas la remise de ligne comme remise de vente', () => {
    const avecRemiseLigne = [{ ...panier[0]!, remise_percent: 10 }];
    const totaux = calculerTotaux(avecRemiseLigne, 0);
    expect(remiseDepuisVente(avecRemiseLigne, totaux.total_ttc)).toBe(0);
  });
});
