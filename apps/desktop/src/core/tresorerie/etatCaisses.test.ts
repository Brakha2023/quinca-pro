import { describe, expect, it } from 'vitest';
import {
  etatCaisses,
  filtrerCaisses,
  perimetreCaisses,
  recapEtatCaisses,
  type MouvementCaisse,
} from './etatCaisses';
import type { Caisse } from './tresorerie';

const caisse = (id: string, code: string, nom: string, solde: number, active = true): Caisse => ({
  id, code, nom, responsable: 'Awa Koné', solde_actuel: solde, filiale_id: 'f1', est_active: active,
});

const mvt = (caisseId: string, date: string, type: 'RECETTE' | 'DEPENSE', montant: number): MouvementCaisse => ({
  caisse_id: caisseId, date_operation: date, type, montant,
});

const FIN = '2026-10-18T23:59:59.999Z';

describe('etatCaisses', () => {
  const caisses = [caisse('c1', '001', 'Caisse principale', 610_500), caisse('c2', '002', 'Coffre', 200_000)];
  const mouvements = [
    mvt('c1', '2026-10-18T09:00:00.000Z', 'RECETTE', 375_500),
    mvt('c1', '2026-10-18T12:00:00.000Z', 'DEPENSE', 100_000),
    mvt('c2', '2026-10-18T12:00:00.000Z', 'RECETTE', 200_000),
  ];

  it('remonte l’ouverture de chaque caisse depuis son solde d’aujourd’hui', () => {
    const [principale, coffre] = etatCaisses(caisses, mouvements, FIN);
    expect(principale).toMatchObject({ ouverture: 335_000, recettes: 375_500, depenses: 100_000, cloture: 610_500, mouvements: 2 });
    expect(coffre).toMatchObject({ ouverture: 0, recettes: 200_000, depenses: 0, cloture: 200_000, mouvements: 1 });
  });

  it('sur une période passée, les mouvements d’après comptent pour l’ouverture mais pas pour la période', () => {
    // La veille : la caisse a ouvert à 335 000 et fermé à 610 500 ; les
    // 50 000 encaissés le lendemain ne sont ni recette ni dépense de la veille,
    // mais ils ont bien laissé le solde d'aujourd'hui à 660 500.
    const apres = [...mouvements, mvt('c1', '2026-10-19T08:00:00.000Z', 'RECETTE', 50_000)];
    const [principale] = etatCaisses([caisse('c1', '001', 'Caisse principale', 660_500)], apres, FIN);
    expect(principale).toMatchObject({ ouverture: 335_000, recettes: 375_500, depenses: 100_000, cloture: 610_500, solde_actuel: 660_500 });
  });

  it('laisse l’ouverture au solde actuel quand rien n’a bougé', () => {
    expect(etatCaisses([caisse('c3', '003', 'Caisse vide', 42_000)], [], FIN)[0])
      .toMatchObject({ ouverture: 42_000, recettes: 0, depenses: 0, cloture: 42_000, mouvements: 0 });
  });

  it('suit une caisse descendue dans le rouge', () => {
    const [ligne] = etatCaisses([caisse('c1', '001', 'Caisse principale', -19_780)], [mvt('c1', '2026-10-18T09:00:00.000Z', 'DEPENSE', 100_000)], FIN);
    expect(ligne).toMatchObject({ ouverture: 80_220, depenses: 100_000, cloture: -19_780 });
  });
});

describe('recapEtatCaisses', () => {
  it('totalise colonne par colonne et compte les caisses dans le rouge', () => {
    const lignes = etatCaisses(
      [caisse('c1', '001', 'Principale', 610_500), caisse('c2', '002', 'Coffre', -19_780), caisse('c3', '003', 'Fermée', 0, false)],
      [mvt('c1', '2026-10-18T09:00:00.000Z', 'RECETTE', 375_500), mvt('c2', '2026-10-18T09:00:00.000Z', 'DEPENSE', 100_000)],
      FIN,
    );
    expect(recapEtatCaisses(lignes)).toEqual({
      nombre: 3, actives: 2, ouverture: 315_220, recettes: 375_500, depenses: 100_000,
      cloture: 590_720, solde_actuel: 590_720, negatives: 1, mouvements: 2,
    });
  });
});

describe('filtrerCaisses', () => {
  const lignes = etatCaisses(
    [caisse('c1', '0011', 'BACI MR TM', 66_301_338), caisse('c2', 'CAIGES', 'Caisse de gestion', 0), caisse('c3', '004', 'Caisse interne', -19_780_083, false)],
    [mvt('c1', '2026-10-18T09:00:00.000Z', 'RECETTE', 1_000)],
    FIN,
  );

  it('ne garde que les caisses actives par défaut', () => {
    expect(filtrerCaisses(lignes).map((l) => l.code)).toEqual(['0011', 'CAIGES']);
  });

  it('cherche dans le code, le libellé et le responsable', () => {
    expect(filtrerCaisses(lignes, { recherche: 'baci', etat: 'TOUTES' }).map((l) => l.code)).toEqual(['0011']);
    expect(filtrerCaisses(lignes, { recherche: 'CAIGES', etat: 'TOUTES' }).map((l) => l.code)).toEqual(['CAIGES']);
  });

  it('isole les caisses fermées, mouvementées ou négatives', () => {
    expect(filtrerCaisses(lignes, { etat: 'INACTIVES' }).map((l) => l.code)).toEqual(['004']);
    expect(filtrerCaisses(lignes, { etat: 'MOUVEMENTEES' }).map((l) => l.code)).toEqual(['0011']);
    expect(filtrerCaisses(lignes, { etat: 'NEGATIVES' }).map((l) => l.code)).toEqual(['004']);
  });
});

describe('perimetreCaisses', () => {
  it('écrit les filtres en toutes lettres', () => {
    expect(perimetreCaisses({ etat: 'NEGATIVES', debut: '01/10/2026', fin: '18/10/2026', recherche: 'baci' }))
      .toBe('Soldes négatifs · du 01/10/2026 au 18/10/2026 · recherche « baci »');
  });

  it('annonce les caisses actives quand rien n’est choisi', () => {
    expect(perimetreCaisses({ debut: '01/10/2026', fin: '18/10/2026' })).toBe('Caisses actives · du 01/10/2026 au 18/10/2026');
  });
});
