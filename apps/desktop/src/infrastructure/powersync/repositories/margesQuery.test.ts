import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { margesArticles, margesCategories, recapMarges, type MargeArticleRow } from '../../../core/rapports';
import { margesQuery } from './RapportsRepository';

/**
 * La marge se joue dans la requête : elle réunit deux tables qui ne portent
 * chacune que la moitié du calcul, et elle répartit la remise de la vente sur
 * ses lignes. Une erreur là ne se voit pas à la lecture — un rapport faux
 * s'imprime aussi bien qu'un rapport juste. On l'exécute donc sur un vrai
 * SQLite, le moteur que PowerSync fait tourner sur le poste.
 *
 * ### Ce que le jeu d'essai tient
 *
 *   * une vente sans remise, où la ligne vaut son hors-taxes ;
 *   * une vente remisée de 10 %, où chaque ligne doit porter sa part — et dont
 *     la somme doit redonner le net de la vente, pas le brut des lignes ;
 *   * une vente annulée, sortie du chiffre d'affaires, dont la sortie de stock
 *     et le retour s'annulent au coût ;
 *   * un article renommé depuis la vente, qui doit faire **une** ligne et non
 *     deux — son chiffre d'affaires sous l'ancien nom, son coût sous le nouveau ;
 *   * un article sorti du catalogue, qui garde sa trace sous son code ;
 *   * une sortie sans coût au journal, retombée sur le coût moyen du dépôt ;
 *   * une autre filiale et une vente hors période, qui n'entrent pas.
 */
function baseDeDemonstration() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE familles_articles (id TEXT PRIMARY KEY, nom TEXT, filiale_id TEXT, est_active INTEGER);
    CREATE TABLE articles (id TEXT PRIMARY KEY, code TEXT, designation TEXT, unite TEXT, famille_id TEXT, filiale_id TEXT);
    CREATE TABLE stocks (id TEXT PRIMARY KEY, article_id TEXT, depot_id TEXT, cout_moyen REAL);
    CREATE TABLE ventes (id TEXT PRIMARY KEY, filiale_id TEXT, statut TEXT, date_vente TEXT, total_net_ht REAL);
    CREATE TABLE lignes_vente (id TEXT PRIMARY KEY, vente_id TEXT, article_id TEXT, code_article TEXT, designation TEXT, quantite REAL, total_ht REAL);
    CREATE TABLE mouvements_stock (id TEXT PRIMARY KEY, article_id TEXT, depot_id TEXT, filiale_id TEXT, type TEXT, quantite REAL, cout_unitaire REAL, created_at TEXT);

    INSERT INTO familles_articles VALUES ('f1','Matériaux','F',1), ('f2','Peinture','F',1);
    INSERT INTO articles VALUES
      ('a1','CIM-50','Ciment 50 kg','SAC','f1','F'),
      ('a2','PEI-20','Peinture 20 L','POT','f2','F'),
      ('a3','FER-12','Fer à béton 12','BARRE','f1','F'),
      ('a9','AUT-01','Article d''une autre filiale','PIECE','f1','AUTRE');
    INSERT INTO stocks VALUES ('s1','a1','d1',3000), ('s2','a2','d1',18000), ('s3','a3','d1',2000);

    -- Vente sans remise : 300 000 HT de lignes, 300 000 de net.
    INSERT INTO ventes VALUES ('v1','F','VALIDEE','2026-11-02T10:00:00.000Z',300000);
    INSERT INTO lignes_vente VALUES
      ('l1','v1','a1','CIM-50','Ciment 50 kg',50,200000),
      ('l2','v1','a2','PEI-20','Peinture 20 L',4,100000);
    INSERT INTO mouvements_stock VALUES
      ('m1','a1','d1','F','SORTIE_VENTE',50,3000,'2026-11-02T10:00:00.000Z'),
      ('m2','a2','d1','F','SORTIE_VENTE',4,18000,'2026-11-02T10:00:00.000Z');

    -- Vente remisée : 100 000 HT de lignes, 90 000 de net. Le fer y figure
    -- sous son ancienne désignation, le catalogue l'a renommé depuis.
    INSERT INTO ventes VALUES ('v2','F','VALIDEE','2026-11-03T09:00:00.000Z',90000);
    INSERT INTO lignes_vente VALUES
      ('l3','v2','a3','FER-12','Fer 12',20,60000),
      ('l4','v2','a1','CIM-50','Ciment 50 kg',10,40000);
    -- Sortie sans coût au journal : elle retombe sur le coût moyen du dépôt.
    INSERT INTO mouvements_stock VALUES
      ('m3','a3','d1','F','SORTIE_VENTE',20,NULL,'2026-11-03T09:00:00.000Z'),
      ('m4','a1','d1','F','SORTIE_VENTE',10,3000,'2026-11-03T09:00:00.000Z');

    -- Vente annulée : hors du chiffre d'affaires, et son coût s'annule.
    INSERT INTO ventes VALUES ('v3','F','ANNULEE','2026-11-03T15:00:00.000Z',50000);
    INSERT INTO lignes_vente VALUES ('l5','v3','a2','PEI-20','Peinture 20 L',2,50000);
    INSERT INTO mouvements_stock VALUES
      ('m5','a2','d1','F','SORTIE_VENTE',2,18000,'2026-11-03T15:00:00.000Z'),
      ('m6','a2','d1','F','RETOUR_CLIENT',2,18000,'2026-11-03T15:30:00.000Z');

    -- Hors période.
    INSERT INTO ventes VALUES ('v4','F','VALIDEE','2026-10-01T10:00:00.000Z',80000);
    INSERT INTO lignes_vente VALUES ('l6','v4','a1','CIM-50','Ciment 50 kg',20,80000);
    INSERT INTO mouvements_stock VALUES ('m7','a1','d1','F','SORTIE_VENTE',20,3000,'2026-10-01T10:00:00.000Z');

    -- Autre filiale.
    INSERT INTO ventes VALUES ('v5','AUTRE','VALIDEE','2026-11-02T11:00:00.000Z',70000);
    INSERT INTO lignes_vente VALUES ('l7','v5','a9','AUT-01','Article d''une autre filiale',7,70000);
    INSERT INTO mouvements_stock VALUES ('m8','a9','d1','AUTRE','SORTIE_VENTE',7,5000,'2026-11-02T11:00:00.000Z');

    -- Article sorti du catalogue : la ligne de vente en garde la trace.
    INSERT INTO ventes VALUES ('v6','F','VALIDEE','2026-11-02T16:00:00.000Z',10000);
    INSERT INTO lignes_vente VALUES ('l8','v6',NULL,'OLD-9','Article supprimé',1,10000);
  `);
  return db;
}

const PERIODE = { debut: '2026-11-01T00:00:00.000Z', fin: '2026-11-30T23:59:59.999Z' };

function lire(filialeId: string | null, filtres = PERIODE): MargeArticleRow[] {
  const db = baseDeDemonstration();
  const { sql, params } = margesQuery(filialeId, filtres);
  return db.prepare(sql).all(...params) as unknown as MargeArticleRow[];
}

describe('margesQuery', () => {
  it('rend une ligne par article vendu, chiffre d’affaires et coût réunis', () => {
    const lignes = margesArticles(lire('F'));
    // Rendues par désignation : « Article supprimé », « Ciment », « Fer », « Peinture ».
    expect(lignes.map((l) => l.code)).toEqual(['OLD-9', 'CIM-50', 'FER-12', 'PEI-20']);
    expect(lignes.find((l) => l.code === 'CIM-50')).toMatchObject({
      libelle: 'Ciment 50 kg', famille: 'Matériaux', ca_ht: 236_000, cout: 180_000, marge: 56_000, quantite: 60, lignes: 2,
    });
    expect(lignes.find((l) => l.code === 'PEI-20')).toMatchObject({ ca_ht: 100_000, cout: 72_000, marge: 28_000, quantite: 4 });
  });

  it('répartit la remise de la vente sur ses lignes', () => {
    const lignes = margesArticles(lire('F'));
    // 60 000 de hors-taxes sur 100 000 de lignes, pour 90 000 de net : 54 000.
    expect(lignes.find((l) => l.code === 'FER-12')!.ca_ht).toBe(54_000);
    // Et le ciment, 40 000 de hors-taxes dans la même vente : 36 000, qui
    // s'ajoutent aux 200 000 de la vente sans remise.
    expect(lignes.find((l) => l.code === 'CIM-50')!.ca_ht).toBe(236_000);
  });

  it('redonne exactement le chiffre d’affaires net des ventes de la période', () => {
    // 300 000 + 90 000 + 10 000 : le total du rapport est celui du tableau de
    // bord, qui somme `ventes.total_net_ht`. C'est la propriété qui compte.
    expect(recapMarges(margesArticles(lire('F'))).ca_ht).toBe(400_000);
  });

  it('écarte la vente annulée et annule son coût', () => {
    const peinture = margesArticles(lire('F')).find((l) => l.code === 'PEI-20')!;
    // Les 50 000 annulés n'entrent pas, et la sortie suivie du retour laisse
    // le coût des 4 pots vendus, pas celui des 6 qui sont sortis.
    expect(peinture).toMatchObject({ ca_ht: 100_000, cout: 72_000, lignes: 1 });
  });

  it('fait une seule ligne d’un article renommé depuis la vente', () => {
    const fer = margesArticles(lire('F')).filter((l) => l.cle === 'a3');
    expect(fer).toHaveLength(1);
    // La désignation est celle du catalogue, pas celle gardée sur la ligne.
    expect(fer[0]).toMatchObject({ libelle: 'Fer à béton 12', ca_ht: 54_000, cout: 40_000 });
  });

  it('compte les sorties que le journal n’a pas valorisées', () => {
    const fer = margesArticles(lire('F')).find((l) => l.cle === 'a3')!;
    // 20 barres au coût moyen actuel du dépôt, faute de coût au départ.
    expect(fer).toMatchObject({ cout: 40_000, sorties_sans_cout: 1 });
    expect(recapMarges(margesArticles(lire('F'))).sorties_sans_cout).toBe(1);
  });

  it('garde sous son code l’article sorti du catalogue', () => {
    const orphelin = margesArticles(lire('F')).find((l) => l.cle === 'OLD-9')!;
    expect(orphelin).toMatchObject({ libelle: 'Article supprimé', famille: 'Sans catégorie', ca_ht: 10_000, cout: 0 });
  });

  it('ignore les ventes hors période et les autres filiales', () => {
    const codes = margesArticles(lire('F')).map((l) => l.code);
    expect(codes).not.toContain('AUT-01');
    // Le ciment est là, mais sans les 80 000 d'octobre.
    expect(margesArticles(lire('F')).find((l) => l.code === 'CIM-50')!.ca_ht).toBe(236_000);
  });

  it('additionne toutes les filiales pour un directeur', () => {
    const recap = recapMarges(margesArticles(lire(null)));
    // Les 70 000 de l'autre filiale s'ajoutent aux 400 000.
    expect(recap.ca_ht).toBe(470_000);
    expect(recap.cout).toBe(180_000 + 72_000 + 40_000 + 35_000);
  });

  it('regroupe les catégories sur les mêmes chiffres', () => {
    const categories = margesCategories(margesArticles(lire('F')));
    expect(categories.find((c) => c.cle === 'f1')).toMatchObject({ libelle: 'Matériaux', ca_ht: 290_000, cout: 220_000, marge: 70_000, articles: 2 });
    expect(categories.find((c) => c.cle === 'f2')).toMatchObject({ libelle: 'Peinture', marge: 28_000, articles: 1 });
    expect(categories.find((c) => c.cle === 'sans-categorie')).toMatchObject({ marge: 10_000 });
  });

  it('ne rend rien sur une période sans vente', () => {
    expect(lire('F', { debut: '2026-01-01T00:00:00.000Z', fin: '2026-01-31T23:59:59.999Z' })).toHaveLength(0);
  });
});
