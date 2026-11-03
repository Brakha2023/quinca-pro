import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { parametresSerie, serieQuery } from './PilotageRepository';

/**
 * L'histogramme du tableau de bord : une barre par jour, le chiffre
 * d'affaires d'un côté, le coût de la marchandise sortie de l'autre.
 *
 * Les deux chiffres ne viennent pas de la même table ni de la même date — le
 * chiffre d'affaires de `ventes.date_vente`, le coût du `created_at` du
 * mouvement. Tant que la vente tient, les deux tombent au même instant. Une
 * **annulation**, elle, vient plus tard : c'est le seul endroit où les deux
 * dates se séparent, et c'est ce que ce jeu d'essai éprouve.
 */
function baseDeDemonstration() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE ventes (id TEXT PRIMARY KEY, numero TEXT, filiale_id TEXT, statut TEXT, date_vente TEXT, total_net_ht REAL);
    CREATE TABLE stocks (id TEXT PRIMARY KEY, article_id TEXT, depot_id TEXT, cout_moyen REAL);
    CREATE TABLE mouvements_stock (id TEXT PRIMARY KEY, article_id TEXT, depot_id TEXT, filiale_id TEXT, type TEXT, quantite REAL, cout_unitaire REAL, reference TEXT, created_at TEXT);

    INSERT INTO stocks VALUES ('s1','a1','d1',3000);

    -- Le 2 : une vente qui tient. 100 000 de chiffre, 60 000 de coût.
    INSERT INTO ventes VALUES ('v1','VTE-1','F','VALIDEE','2026-11-02T10:00:00.000Z',100000);
    INSERT INTO mouvements_stock VALUES ('m1','a1','d1','F','SORTIE_VENTE',20,3000,'VTE-1','2026-11-02T10:00:00.000Z');

    -- Le 3 : une vente annulée le jour même. Ni chiffre, ni coût.
    INSERT INTO ventes VALUES ('v2','VTE-2','F','ANNULEE','2026-11-03T10:00:00.000Z',50000);
    INSERT INTO mouvements_stock VALUES
      ('m2','a1','d1','F','SORTIE_VENTE',10,3000,'VTE-2','2026-11-03T10:00:00.000Z'),
      ('m3','a1','d1','F','RETOUR_CLIENT',10,3000,'VTE-2','2026-11-03T11:00:00.000Z');

    -- Le 4 : une vente annulée le 5, donc un jour plus tard.
    INSERT INTO ventes VALUES ('v3','VTE-3','F','ANNULEE','2026-11-04T10:00:00.000Z',80000);
    INSERT INTO mouvements_stock VALUES
      ('m4','a1','d1','F','SORTIE_VENTE',15,3000,'VTE-3','2026-11-04T10:00:00.000Z'),
      ('m5','a1','d1','F','RETOUR_CLIENT',15,3000,'VTE-3','2026-11-05T09:00:00.000Z');

    -- Une pièce annulée sans numéro : venue d'une version ancienne ou d'une
    -- écriture serveur. Elle ne doit rien emporter avec elle.
    INSERT INTO ventes VALUES ('v4',NULL,'F','ANNULEE','2026-11-02T18:00:00.000Z',10000);
  `);
  return db;
}

interface PointBrut { cle: string; ca_ht: number; cout: number; ventes: number }

const lireSerie = (): PointBrut[] => {
  const db = baseDeDemonstration();
  return db
    .prepare(serieQuery('JOUR'))
    .all(...parametresSerie('2026-11-01T00:00:00.000Z', '2026-11-30T23:59:59.999Z', 'F')) as unknown as PointBrut[];
};

describe('serieQuery', () => {
  /**
   * Et au passage : une seule pièce annulée sans numéro rendrait le `NOT IN`
   * indécidable et effacerait le coût de toutes les journées. C'est ce que
   * cette barre, restée à 60 000 F, vérifie aussi.
   */
  it('porte le chiffre d’affaires et le coût de la journée', () => {
    const jour = lireSerie().find((p) => p.cle === '2026-11-02');
    expect(jour).toMatchObject({ ca_ht: 100_000, cout: 60_000, ventes: 1 });
  });

  /**
   * Une vente annulée ne laisse rien derrière elle, et surtout pas un coût
   * sans sa recette : la barre du jour de la vente marquerait une perte, et
   * celle du jour de l'annulation un gain du même montant — pour une vente
   * qui n'a jamais eu lieu.
   */
  it('n’étale pas une vente annulée sur deux journées', () => {
    const serie = lireSerie();
    const jour = (cle: string) => serie.find((p) => p.cle === cle);
    // Le jour même : déjà juste avant, la sortie et le retour s'annulaient.
    expect(jour('2026-11-03')?.cout ?? 0).toBe(0);
    // Le lendemain : c'est le cas qui faisait mentir l'histogramme.
    expect(jour('2026-11-04')?.cout ?? 0).toBe(0);
    expect(jour('2026-11-05')?.cout ?? 0).toBe(0);
    // Et le total de la fenêtre ne tient que la vente qui a tenu.
    expect(serie.reduce((t, p) => t + p.cout, 0)).toBe(60_000);
    expect(serie.reduce((t, p) => t + p.ca_ht, 0)).toBe(100_000);
  });
});
