import { describe, expect, it } from 'vitest';
import { alertesStock, montantACommander, perimetreAlertes, quantiteACommander, recapAlertes, type LigneAlerteStock } from './alertes';

const ligne = (over: Partial<LigneAlerteStock> = {}): LigneAlerteStock => ({
  article_id: 'a', code: 'A-1', designation: 'Article', unite: 'PIECE', famille_nom: null,
  quantite: 0, stock_min: 10, stock_max: 0, prix_achat: 1000, valeur: 0, ...over,
});

describe('quantiteACommander', () => {
  it('vise le stock maximum quand il est renseigné', () => {
    expect(quantiteACommander({ quantite: 20, stock_min: 10, stock_max: 50 })).toBe(30);
  });

  it('à défaut, deux fois le minimum : de quoi tenir jusqu’à la livraison', () => {
    expect(quantiteACommander({ quantite: 4, stock_min: 10, stock_max: 0 })).toBe(16);
  });

  it('creuse la commande d’un stock négatif au lieu de l’ignorer', () => {
    expect(quantiteACommander({ quantite: -5, stock_min: 10, stock_max: 0 })).toBe(25);
  });

  it('ne commande rien sans seuil, et rien quand le stock est au-dessus', () => {
    expect(quantiteACommander({ quantite: 0, stock_min: 0, stock_max: 0 })).toBe(0);
    expect(quantiteACommander({ quantite: 80, stock_min: 10, stock_max: 50 })).toBe(0);
  });

  it('chiffre la commande au dernier prix d’achat connu', () => {
    expect(montantACommander(ligne({ quantite: 0, stock_min: 10, prix_achat: 2500 }))).toBe(50000);
  });
});

describe('alertesStock', () => {
  const rupture = ligne({ article_id: 'r', designation: 'Zinc', quantite: 0, stock_min: 5 });
  const faible = ligne({ article_id: 'f', designation: 'Ciment', quantite: 5, stock_min: 5 });
  const normal = ligne({ article_id: 'n', designation: 'Brique', quantite: 100, stock_min: 5 });

  it('ne retient que ce qui est en alerte', () => {
    expect(alertesStock([rupture, faible, normal]).map((l) => l.article_id)).toEqual(['r', 'f']);
  });

  it('met les ruptures devant, puis l’ordre alphabétique', () => {
    const autre = ligne({ article_id: 'r2', designation: 'Acier', quantite: 0, stock_min: 5 });
    expect(alertesStock([faible, rupture, autre]).map((l) => l.article_id)).toEqual(['r2', 'r', 'f']);
  });

  it('sait n’imprimer qu’une nature', () => {
    expect(alertesStock([rupture, faible, normal], 'RUPTURE').map((l) => l.article_id)).toEqual(['r']);
    expect(alertesStock([rupture, faible, normal], 'FAIBLE').map((l) => l.article_id)).toEqual(['f']);
  });
});

describe('recapAlertes', () => {
  it('chiffre la commande à passer', () => {
    const r = recapAlertes([
      ligne({ quantite: 0, stock_min: 10, prix_achat: 1000 }),
      ligne({ quantite: 5, stock_min: 5, stock_max: 20, prix_achat: 500 }),
    ]);
    expect(r).toMatchObject({ ruptures: 1, faibles: 1, quantite_a_commander: 35, montant_a_commander: 27500 });
  });

  it('signale les articles sans seuil : ils ne déclencheront jamais d’alerte', () => {
    const toutes = [ligne({ stock_min: 0, stock_max: 0 }), ligne({ stock_min: 10 })];
    expect(recapAlertes([], toutes).sans_seuil).toBe(1);
  });
});

describe('perimetreAlertes', () => {
  it('dit sur quoi porte la liste', () => {
    expect(perimetreAlertes({ nature: 'TOUTES' })).toBe('Ruptures et stocks faibles · tous dépôts · toutes familles');
    expect(perimetreAlertes({ nature: 'RUPTURE', depotNom: 'Principal', familleNom: 'CARREAU', recherche: ' 250 ' }))
      .toBe('Ruptures seulement · dépôt « Principal » · famille « CARREAU » · recherche « 250 »');
  });
});
