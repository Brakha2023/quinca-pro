import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import { classerRotation, recapRotation, type RotationRow } from '../../../core/stock';
import { rotationStockQuery } from './StockRepository';

/**
 * La rotation se décide sur un agrégat : dernière sortie par article, et
 * quantité sortie sur la période. Un agrégat faux ne se voit pas à la lecture,
 * on l'exécute donc sur un vrai SQLite — le moteur que PowerSync fait tourner
 * sur le poste.
 *
 * Le jeu d'essai tient le piège principal : une entrée récente ne réveille pas
 * un article, et un transfert ou une casse non plus. Seule une sortie vendue,
 * déstockée ou consommée compte.
 */
const MAINTENANT = new Date('2026-11-02T12:00:00.000Z');

function baseDeDemonstration() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE articles (id TEXT PRIMARY KEY, code TEXT, designation TEXT, unite TEXT, famille_id TEXT, filiale_id TEXT, est_actif INTEGER);
    CREATE TABLE familles_articles (id TEXT PRIMARY KEY, nom TEXT);
    CREATE TABLE stocks (id TEXT PRIMARY KEY, article_id TEXT, depot_id TEXT, quantite REAL, cout_moyen REAL);
    CREATE TABLE mouvements_stock (id TEXT PRIMARY KEY, article_id TEXT, depot_id TEXT, filiale_id TEXT, type TEXT, quantite REAL, created_at TEXT);

    INSERT INTO familles_articles VALUES ('f1','Quincaillerie');
    INSERT INTO articles VALUES ('a1','CIM-50','Ciment 50kg','SAC','f1','F',1);
    INSERT INTO articles VALUES ('a2','PEI-20','Peinture 20L','POT','f1','F',1);
    INSERT INTO articles VALUES ('a3','VIS-50','Vis 50mm','BOITE','f1','F',1);
    INSERT INTO articles VALUES ('a4','FER-12','Fer à béton','BARRE','f1','F',1);
    INSERT INTO articles VALUES ('a5','OLD-01','Article désactivé','PIECE','f1','F',0);
    INSERT INTO articles VALUES ('a9','AUT-01','Autre filiale','PIECE','f1','AUTRE',1);

    -- Ciment : du stock dans deux dépôts, vendu avant-hier → actif.
    INSERT INTO stocks VALUES ('s1','a1','d1',100,4500);
    INSERT INTO stocks VALUES ('s2','a1','d2',20,4500);
    INSERT INTO mouvements_stock VALUES ('m1','a1','d1','F','SORTIE_VENTE',10,'2026-10-31T09:00:00.000Z');
    -- Peinture : en stock, aucune sortie depuis huit mois → dormante, et chère.
    INSERT INTO stocks VALUES ('s3','a2','d1',12,25000);
    INSERT INTO mouvements_stock VALUES ('m2','a2','d1','F','SORTIE_VENTE',1,'2026-03-02T09:00:00.000Z');
    -- Vis : réapprovisionnées hier, mais plus vendues depuis des mois ; une
    -- casse et un transfert récents ne doivent pas les réveiller non plus.
    INSERT INTO stocks VALUES ('s4','a3','d1',40,2000);
    INSERT INTO mouvements_stock VALUES ('m3','a3','d1','F','ENTREE_ACHAT',40,'2026-11-01T09:00:00.000Z');
    INSERT INTO mouvements_stock VALUES ('m4','a3','d1','F','CASSE',2,'2026-11-01T10:00:00.000Z');
    INSERT INTO mouvements_stock VALUES ('m5','a3','d1','F','TRANSFERT_SORTIE',5,'2026-11-01T11:00:00.000Z');
    INSERT INTO mouvements_stock VALUES ('m6','a3','d2','F','TRANSFERT_ENTREE',5,'2026-11-01T11:00:01.000Z');
    -- Fer : plus une barre en stock — ce n'est pas du dormant, c'est une rupture.
    INSERT INTO stocks VALUES ('s5','a4','d1',0,6000);
    -- Désactivé et autre filiale : hors sujet.
    INSERT INTO stocks VALUES ('s6','a5','d1',5,1000);
    INSERT INTO stocks VALUES ('s7','a9','d1',5,1000);
  `);
  return db;
}

function rotation(filtres: Parameters<typeof rotationStockQuery>[1], seuilJours = 90) {
  const db = baseDeDemonstration();
  const { sql, params } = rotationStockQuery('F', filtres);
  const rows = db.prepare(sql).all(...params) as unknown as RotationRow[];
  return classerRotation(rows, { seuilJours, maintenant: MAINTENANT });
}

const DEPUIS = '2026-08-04T00:00:00.000Z';

describe('rotationStockQuery', () => {
  it('sépare ce qui dort de ce qui tourne, le plus cher d’abord', () => {
    const { dormants, actifs } = rotation({ depuis: DEPUIS });
    expect(dormants.map((l) => l.code)).toEqual(['PEI-20', 'VIS-50']);
    expect(actifs.map((l) => l.code)).toEqual(['CIM-50']);
    // 12 pots à 25 000 avant 40 boîtes à 2 000 : c'est la somme qui décide.
    expect(dormants[0]).toMatchObject({ valeur: 300_000, quantite: 12, jours: 245 });
  });

  it('totalise le stock d’un article sur tous ses dépôts', () => {
    const { actifs } = rotation({ depuis: DEPUIS });
    expect(actifs[0]).toMatchObject({ code: 'CIM-50', quantite: 120, valeur: 540_000, quantite_sortie: 10, jours: 2 });
  });

  it('ne réveille pas un article pour une entrée, une casse ou un transfert', () => {
    const vis = rotation({ depuis: DEPUIS }).dormants.find((l) => l.code === 'VIS-50');
    expect(vis).toMatchObject({ derniere_sortie: null, jours: null, quantite_sortie: 0 });
  });

  it('laisse les ruptures aux alertes : sans stock, rien ne dort', () => {
    const { dormants, actifs } = rotation({ depuis: DEPUIS });
    expect([...dormants, ...actifs].map((l) => l.code)).not.toContain('FER-12');
  });

  it('ignore les articles désactivés et les autres filiales', () => {
    const { dormants, actifs } = rotation({ depuis: DEPUIS });
    const codes = [...dormants, ...actifs].map((l) => l.code);
    expect(codes).not.toContain('OLD-01');
    expect(codes).not.toContain('AUT-01');
  });

  it('filtre le stock et les sorties sur le même dépôt', () => {
    // Au dépôt 2, le ciment n'a jamais été vendu : il y dort.
    const { dormants, actifs } = rotation({ depuis: DEPUIS, depotId: 'd2' });
    expect(actifs).toHaveLength(0);
    expect(dormants.find((l) => l.code === 'CIM-50')).toMatchObject({ quantite: 20, derniere_sortie: null });
  });

  it('suit la famille et la recherche', () => {
    expect(rotation({ depuis: DEPUIS, recherche: 'peinture' }).dormants.map((l) => l.code)).toEqual(['PEI-20']);
    expect(rotation({ depuis: DEPUIS, familleId: 'f2' }).dormants).toHaveLength(0);
  });

  it('déplace la frontière avec le seuil choisi', () => {
    // À 180 jours, la peinture vendue il y a 245 jours dort encore ; à 365, non.
    expect(rotation({ depuis: DEPUIS }, 180).dormants.map((l) => l.code)).toEqual(['PEI-20', 'VIS-50']);
    expect(rotation({ depuis: DEPUIS }, 365).dormants.map((l) => l.code)).toEqual(['VIS-50']);
  });

  it('chiffre la part du stock qui dort', () => {
    const { dormants, actifs } = rotation({ depuis: DEPUIS });
    const recap = recapRotation(dormants, actifs);
    // 380 000 F dorment sur 920 000 F de stock.
    expect(recap).toMatchObject({ articles_dormants: 2, valeur_dormante: 380_000, articles_actifs: 1, valeur_active: 540_000, part_dormante: 41 });
  });
});
