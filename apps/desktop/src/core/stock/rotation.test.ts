import { describe, expect, it } from 'vitest';
import { TYPES_SORTIE_ROTATION, classerRotation, joursDepuis, perimetreRotation, recapRotation, type RotationRow } from './rotation';

const MAINTENANT = new Date('2026-11-02T12:00:00.000Z');

const ligne = (over: Partial<RotationRow> = {}): RotationRow => ({
  article_id: 'a1',
  code: 'CIM-50',
  designation: 'Ciment 50kg',
  unite: 'SAC',
  famille_nom: 'Quincaillerie',
  quantite: 10,
  valeur: 45_000,
  derniere_sortie: '2026-10-31T09:00:00.000Z',
  quantite_sortie: 4,
  ...over,
});

const classer = (rows: RotationRow[], seuilJours = 90) => classerRotation(rows, { seuilJours, maintenant: MAINTENANT });

describe('TYPES_SORTIE_ROTATION', () => {
  it('ne retient que ce qui est vraiment parti', () => {
    expect(TYPES_SORTIE_ROTATION).toEqual(['SORTIE_VENTE', 'SORTIE_DESTOCKAGE', 'SORTIE_PRODUCTION']);
    // Une casse est une perte, un transfert un déplacement : ni l'une ni l'autre ne prouve qu'un article tourne.
    expect(TYPES_SORTIE_ROTATION).not.toContain('CASSE');
    expect(TYPES_SORTIE_ROTATION).not.toContain('TRANSFERT_SORTIE');
  });
});

describe('joursDepuis', () => {
  it('compte les jours entiers écoulés', () => {
    expect(joursDepuis('2026-10-31T09:00:00.000Z', MAINTENANT)).toBe(2);
    expect(joursDepuis('2026-11-02T06:00:00.000Z', MAINTENANT)).toBe(0);
  });

  it('rend null sans date, et ne rend jamais de jours négatifs', () => {
    expect(joursDepuis(null, MAINTENANT)).toBeNull();
    expect(joursDepuis('pas une date', MAINTENANT)).toBeNull();
    // Horloge du poste en retard sur un mouvement : zéro, pas « il y a -1 jour ».
    expect(joursDepuis('2026-11-03T09:00:00.000Z', MAINTENANT)).toBe(0);
  });
});

describe('classerRotation', () => {
  it('sépare au seuil demandé, bornes comprises', () => {
    const vieux = ligne({ article_id: 'a2', code: 'PEI-20', derniere_sortie: '2026-08-04T12:00:00.000Z' }); // 90 jours pile
    expect(classer([vieux]).dormants.map((l) => l.code)).toEqual(['PEI-20']);
    expect(classer([vieux], 91).actifs.map((l) => l.code)).toEqual(['PEI-20']);
  });

  it('tient un article jamais vu sortir pour dormant', () => {
    const jamais = classer([ligne({ derniere_sortie: null, quantite_sortie: null })]).dormants[0];
    expect(jamais).toMatchObject({ jours: null, dormant: true, quantite_sortie: 0 });
  });

  it('écarte ce qui n’a pas de stock : une rupture n’est pas du dormant', () => {
    const { dormants, actifs } = classer([ligne({ quantite: 0, derniere_sortie: null }), ligne({ article_id: 'a3', code: 'VIS', quantite: -2 })]);
    expect([...dormants, ...actifs]).toHaveLength(0);
  });

  it('range les dormants du plus cher au moins cher', () => {
    const { dormants } = classer([
      ligne({ article_id: 'a1', code: 'PETIT', valeur: 12_000, derniere_sortie: null }),
      ligne({ article_id: 'a2', code: 'GROS', valeur: 300_000, derniere_sortie: null }),
    ]);
    expect(dormants.map((l) => l.code)).toEqual(['GROS', 'PETIT']);
  });

  it('range les actifs du plus sorti au moins sorti', () => {
    const { actifs } = classer([
      ligne({ article_id: 'a1', code: 'LENT', quantite_sortie: 2 }),
      ligne({ article_id: 'a2', code: 'RAPIDE', quantite_sortie: 40 }),
    ]);
    expect(actifs.map((l) => l.code)).toEqual(['RAPIDE', 'LENT']);
  });

  it('survit à une ligne sans rien : la base peut rendre des colonnes nulles', () => {
    const { dormants } = classer([{ article_id: null, code: null, designation: null, unite: null, famille_nom: null, quantite: 3, valeur: null, derniere_sortie: null, quantite_sortie: null }]);
    expect(dormants[0]).toMatchObject({ code: '', designation: '', valeur: 0, dormant: true });
  });
});

describe('recapRotation', () => {
  it('chiffre la part du stock qui dort', () => {
    const { dormants, actifs } = classer([
      ligne({ article_id: 'a1', code: 'DORT', valeur: 300_000, derniere_sortie: null }),
      ligne({ article_id: 'a2', code: 'TOURNE', valeur: 100_000 }),
    ]);
    expect(recapRotation(dormants, actifs)).toEqual({
      articles_dormants: 1, valeur_dormante: 300_000, articles_actifs: 1, valeur_active: 100_000, part_dormante: 75,
    });
  });

  it('ne divise pas par zéro quand il n’y a pas de stock', () => {
    expect(recapRotation([], [])).toMatchObject({ part_dormante: 0, valeur_dormante: 0 });
  });
});

describe('perimetreRotation', () => {
  it('écrit le périmètre observé sur la feuille', () => {
    expect(perimetreRotation({ seuilJours: 90 })).toBe('sans sortie depuis 90 jours · tous dépôts · toutes familles');
    expect(perimetreRotation({ seuilJours: 30, depotNom: 'Principal', familleNom: 'Peinture', recherche: ' vis ' }))
      .toBe('sans sortie depuis 30 jours · dépôt « Principal » · famille « Peinture » · recherche « vis »');
  });
});
