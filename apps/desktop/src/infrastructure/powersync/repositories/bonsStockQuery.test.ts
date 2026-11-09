import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  TYPES_BON_ENTREE,
  TYPES_BON_INVENTAIRE,
  TYPES_BON_SORTIE,
  TYPES_BON_TRANSFERT,
  resumeBon,
  type BonStockRow,
} from '../../../core/stock';
import { bonsStockQuery } from './StockRepository';

/**
 * La requête des bons regroupe en SQL, et un agrégat faux ne se voit pas à la
 * lecture : on l'exécute donc sur un vrai SQLite, le même moteur que PowerSync
 * fait tourner sur le poste.
 *
 * Le piège que ces cas gardent : un transfert écrit deux mouvements par
 * article, et lignes, quantités comme valeur compteraient double si l'entrée
 * n'était pas écartée. Les mouvements du jeu d'essai portent tous un coût,
 * comme ceux qu'écrit `StockRepository` — y compris les sorties, valorisées au
 * coût moyen du dépôt au moment où elles partent.
 */
function baseDeDemonstration() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE articles (id TEXT PRIMARY KEY, code TEXT, designation TEXT);
    CREATE TABLE depots (id TEXT PRIMARY KEY, nom TEXT);
    CREATE TABLE utilisateurs (id TEXT PRIMARY KEY, nom TEXT, prenom TEXT);
    CREATE TABLE fournisseurs (id TEXT PRIMARY KEY, raison_sociale TEXT);
    CREATE TABLE mouvements_stock (id TEXT PRIMARY KEY, article_id TEXT, depot_id TEXT, filiale_id TEXT,
      type TEXT, quantite REAL, quantite_avant REAL, quantite_apres REAL, cout_unitaire REAL,
      reference TEXT, motif TEXT, fournisseur_id TEXT, utilisateur_id TEXT, created_at TEXT,
      remise_montant REAL, date_livraison TEXT, reference_courte TEXT);

    INSERT INTO articles VALUES ('a1','CIM-50','Ciment 50kg'),('a2','VIS-50','Vis 50mm');
    INSERT INTO depots VALUES ('d1','Principal'),('d2','Annexe');
    INSERT INTO utilisateurs VALUES ('u1','Koné','Awa');
    INSERT INTO fournisseurs VALUES ('f1','SOCIMAT CI');

    -- Entrée d'achat : deux lignes, valorisées toutes les deux.
    INSERT INTO mouvements_stock VALUES ('m1','a1','d1','F','ENTREE_ACHAT',10,0,10,4500,'ENT-1','BL 42','f1','u1','2026-10-13T08:00:00.000Z',0,NULL,'ENT-K7Q-000001');
    INSERT INTO mouvements_stock VALUES ('m2','a2','d1','F','ENTREE_ACHAT',5,0,5,2000,'ENT-1','BL 42','f1','u1','2026-10-13T08:00:01.000Z',0,NULL,'ENT-K7Q-000001');
    -- Entrée remisée : 55 000 F de marchandise, 5 500 F de rabais sur le bon
    -- entier, répartis au prorata (4 500 + 1 000), et livrée la veille au soir.
    INSERT INTO mouvements_stock VALUES ('m11','a1','d1','F','ENTREE_ACHAT',10,0,10,4050,'ENT-2','BL 50','f1','u1','2026-10-12T08:00:00.000Z',4500,'2026-10-11T18:30:00.000Z',NULL);
    INSERT INTO mouvements_stock VALUES ('m12','a2','d1','F','ENTREE_ACHAT',5,0,5,1800,'ENT-2','BL 50','f1','u1','2026-10-12T08:00:01.000Z',1000,'2026-10-11T18:30:00.000Z',NULL);
    -- Transfert entre dépôts : les deux moitiés portent le coût moyen du départ.
    INSERT INTO mouvements_stock VALUES ('m3','a1','d1','F','TRANSFERT_SORTIE',4,10,6,4500,'TRF-1',NULL,NULL,'u1','2026-10-14T08:00:00.000Z',0,NULL,NULL);
    INSERT INTO mouvements_stock VALUES ('m4','a1','d2','F','TRANSFERT_ENTREE',4,0,4,4500,'TRF-1',NULL,NULL,'u1','2026-10-14T08:00:01.000Z',0,NULL,NULL);
    -- Inventaire : un écart en moins, un en plus.
    INSERT INTO mouvements_stock VALUES ('m5','a1','d1','F','INVENTAIRE',-2,6,4,4500,'INV-1','Comptage',NULL,'u1','2026-10-15T08:00:00.000Z',0,NULL,NULL);
    INSERT INTO mouvements_stock VALUES ('m6','a2','d1','F','INVENTAIRE',1,5,6,2000,'INV-1','Comptage',NULL,'u1','2026-10-15T08:00:01.000Z',0,NULL,NULL);
    -- Une casse (valorisée : c'est une perte sèche), et une vente qui ne doit
    -- figurer dans aucun onglet de saisie. Un vieux mouvement sans coût aussi.
    INSERT INTO mouvements_stock VALUES ('m7','a2','d1','F','CASSE',2,6,4,2000,'CAS-1','Chute',NULL,'u1','2026-10-16T08:00:00.000Z',0,NULL,NULL);
    INSERT INTO mouvements_stock VALUES ('m10','a2','d1','F','SORTIE_DESTOCKAGE',1,4,3,NULL,'SOR-1','Échantillon',NULL,'u1','2026-10-16T07:00:00.000Z',0,NULL,NULL);
    INSERT INTO mouvements_stock VALUES ('m8','a2','d1','F','SORTIE_VENTE',1,4,3,NULL,'VTE-1',NULL,NULL,'u1','2026-10-16T09:00:00.000Z',0,NULL,NULL);
    -- Une autre filiale, pour vérifier qu'elle reste chez elle.
    INSERT INTO mouvements_stock VALUES ('m9','a1','d1','AUTRE','ENTREE_ACHAT',3,0,3,4500,'ENT-9',NULL,'f1','u1','2026-10-17T08:00:00.000Z',0,NULL,NULL);
  `);
  return db;
}

function bons(filtres: Parameters<typeof bonsStockQuery>[1]) {
  const db = baseDeDemonstration();
  const { sql, params } = bonsStockQuery('F', filtres);
  const lignes = db.prepare(sql).all(...params) as unknown as BonStockRow[];
  return lignes.map(resumeBon);
}

describe('bonsStockQuery', () => {
  it('regroupe les mouvements d’une même référence en un bon valorisé', () => {
    const liste = bons({ types: TYPES_BON_ENTREE });
    expect(liste).toHaveLength(2);
    expect(liste[0]).toMatchObject({
      reference: 'ENT-1', nombre_lignes: 2, quantite: 15, valeur: 55_000,
      depot: 'Principal', fournisseur: 'SOCIMAT CI', utilisateur: 'Awa Koné', motif: 'BL 42',
    });
    expect(liste[0]!.articles).toContain('Ciment 50kg');
  });

  it('ne compte un transfert qu’une fois tout en gardant sa valeur et ses deux dépôts', () => {
    const liste = bons({ types: TYPES_BON_TRANSFERT });
    expect(liste).toHaveLength(1);
    expect(liste[0]).toMatchObject({
      reference: 'TRF-1', nombre_lignes: 1, quantite: 4, valeur: 18_000,
      depot: 'Principal', depot_destination: 'Annexe', libelle: 'Transfert (sortie)',
    });
  });

  it('rend l’écart net d’un inventaire, et chiffre ce qu’une casse a coûté', () => {
    expect(bons({ types: TYPES_BON_INVENTAIRE })[0]).toMatchObject({ reference: 'INV-1', nombre_lignes: 2, quantite: -1, valeur: 11_000 });
    expect(bons({ types: TYPES_BON_SORTIE })[0]).toMatchObject({ reference: 'CAS-1', quantite: 2, valeur: 4_000 });
  });

  it('n’invente pas de valeur pour un bon dont aucune ligne ne porte de coût', () => {
    expect(bons({ types: TYPES_BON_SORTIE }).find((b) => b.reference === 'SOR-1')).toMatchObject({ valeur: null });
  });

  it('laisse les ventes et les autres filiales en dehors', () => {
    const toutes = [...TYPES_BON_ENTREE, ...TYPES_BON_SORTIE, ...TYPES_BON_TRANSFERT, ...TYPES_BON_INVENTAIRE];
    expect(bons({ types: toutes }).map((b) => b.reference)).toEqual(['CAS-1', 'SOR-1', 'INV-1', 'TRF-1', 'ENT-1', 'ENT-2']);
  });

  it('cherche sur le bon entier : une seule ligne qui répond le ramène complet', () => {
    expect(bons({ types: TYPES_BON_ENTREE, recherche: 'VIS' })[0]).toMatchObject({ reference: 'ENT-1', nombre_lignes: 2, quantite: 15 });
    expect(bons({ types: TYPES_BON_ENTREE, recherche: 'BL 42' })).toHaveLength(1);
    expect(bons({ types: TYPES_BON_ENTREE, recherche: 'introuvable' })).toHaveLength(0);
  });

  it('retrouve un bon par son numéro court comme par son numéro long', () => {
    // Le magasinier a le bon sous les yeux : c'est le court qui y est imprimé.
    expect(bons({ types: TYPES_BON_ENTREE, recherche: 'ENT-K7Q-000001' })[0]).toMatchObject({ reference: 'ENT-1' });
    expect(bons({ types: TYPES_BON_ENTREE, recherche: 'ENT-1' })[0]).toMatchObject({ reference: 'ENT-1' });
  });

  it('additionne la remise du bon et garde l’heure de la livraison', () => {
    const remise = bons({ types: TYPES_BON_ENTREE }).find((b) => b.reference === 'ENT-2');
    expect(remise).toMatchObject({ remise: 5_500, valeur: 49_500, date_livraison: '2026-10-11T18:30:00.000Z' });
    // Le brut du bon se déduit du net sans rien reconstituer.
    expect((remise?.valeur ?? 0) + (remise?.remise ?? 0)).toBe(55_000);
    // Un transfert, qui n'en porte pas, ne doit rien inventer.
    expect(bons({ types: TYPES_BON_TRANSFERT })[0]).toMatchObject({ remise: 0, date_livraison: null });
  });

  it('filtre par dépôt sans amputer un transfert de son autre moitié', () => {
    expect(bons({ types: TYPES_BON_TRANSFERT, depotId: 'd2' })[0]).toMatchObject({ reference: 'TRF-1', nombre_lignes: 1, depot: 'Principal', depot_destination: 'Annexe' });
  });

  it('borne la période aux journées entières demandées', () => {
    const toutes = [...TYPES_BON_ENTREE, ...TYPES_BON_TRANSFERT, ...TYPES_BON_INVENTAIRE];
    expect(bons({ types: toutes, debut: '2026-10-14', fin: '2026-10-15' }).map((b) => b.reference)).toEqual(['INV-1', 'TRF-1']);
    expect(bons({ types: toutes, debut: '2026-10-13', fin: '2026-10-13' }).map((b) => b.reference)).toEqual(['ENT-1']);
  });
});
