import { describe, expect, it } from 'vitest';
import type { Cellule } from '../articles';
import { cleTiers, dateImport } from '../commun/importTiers';
import {
  EntetesClientIntrouvablesError, clientsDepuisGrille,
  preparerImportClients, trouverEnteteClient, type LigneImportClient,
} from './importClients';

/** Un fichier tel qu'on le reçoit : un titre, les entêtes, les clients, un total. */
const FICHIER: Cellule[][] = [
  ['LISTE DES CLIENTS AU 31/12/2026', null, null, null],
  ['CODE', 'NOM', 'SOLDE', 'DATE SOLDE'],
  ['CLI-001', 'ETS KOUAME ET FILS', '150 000', '31/12/2026'],
  [null, 'MADAME ADJOUA', -25000, '31/12/2026'],
  ['CLI-003', 'QUINCAILLERIE DU PONT', 0, null],
  ['TOTAL', null, 125000, null],
];

const aucun = { codes: new Set<string>(), noms: new Set<string>() };

describe('trouverEnteteClient', () => {
  it('trouve les entêtes sous le titre, quel que soit le nombre de lignes de tête', () => {
    expect(trouverEnteteClient(FICHIER)).toMatchObject({
      ligne: 1,
      colonnes: { code: 0, raison_sociale: 1, solde_initial: 2, date_effet_solde: 3 },
    });
  });

  // Un répertoire venu d'un cahier n'a ni code ni téléphone : le nom suffit.
  it('se contente du nom', () => {
    expect(trouverEnteteClient([['Raison sociale']])?.colonnes).toEqual({ raison_sociale: 0 });
  });

  it('suit les colonnes dans leur ordre réel', () => {
    const e = trouverEnteteClient([['Créance', 'Client', 'Mobile']]);
    expect(e?.colonnes).toEqual({ solde_initial: 0, raison_sociale: 1, mobile: 2 });
  });

  it('rend null quand aucune colonne ne nomme le client', () => {
    expect(trouverEnteteClient([['Quantité', 'Dépôt']])).toBeNull();
  });
});

describe('dateImport', () => {
  it('lit le jour/mois/année du cahier comme la date d’Excel', () => {
    expect(dateImport('31/12/2026')).toBe('2026-12-31');
    expect(dateImport('5-1-26')).toBe('2026-01-05');
    expect(dateImport(new Date('2026-12-31T00:00:00.000Z'))).toBe('2026-12-31');
    expect(dateImport('2026-12-31')).toBe('2026-12-31');
  });

  /*
   * Ce qu'on ne sait pas lire est laissé vide, jamais deviné : une date
   * d'arrêté fausse déplacerait une créance d'un exercice à l'autre.
   */
  it('ne devine pas une date illisible', () => {
    expect(dateImport('fin décembre')).toBe('');
    expect(dateImport(null)).toBe('');
  });
});

describe('clientsDepuisGrille', () => {
  it('ne perd aucun client et écarte titre et total', () => {
    const lignes = clientsDepuisGrille(FICHIER);
    expect(lignes).toHaveLength(3);
    expect(lignes[0]).toMatchObject({
      code: 'CLI-001', raison_sociale: 'ETS KOUAME ET FILS', solde_initial: 150000, date_effet_solde: '2026-12-31',
    });
  });

  // Positif : le client doit. Négatif : une avance à son crédit.
  it('garde le signe du solde', () => {
    expect(clientsDepuisGrille(FICHIER)[1]).toMatchObject({ raison_sociale: 'MADAME ADJOUA', solde_initial: -25000, code: '' });
  });

  it('refuse un fichier sans entêtes, en disant lesquels', () => {
    expect(() => clientsDepuisGrille([['Quantité'], ['3']])).toThrow(EntetesClientIntrouvablesError);
    expect(() => clientsDepuisGrille([['Quantité'], ['3']])).toThrow(/RAISON SOCIALE/);
  });

  it('remplit ce qui manque sans inventer', () => {
    const [c] = clientsDepuisGrille([['NOM'], ['CLIENT SANS RIEN']]);
    expect(c).toEqual({
      code: '', raison_sociale: 'CLIENT SANS RIEN', solde_initial: 0, date_effet_solde: '',
      mobile: '', telephone: '', adresse: '', ville: '', contact: '', email: '',
      numero_rc: '', numero_cc: '', plafond_credit: 0, groupe: '',
    });
  });
});

describe('preparerImportClients', () => {
  const ligne = (p: Partial<LigneImportClient> = {}): LigneImportClient => ({
    code: '', raison_sociale: 'ETS KOUAME', solde_initial: 0, date_effet_solde: '',
    mobile: '', telephone: '', adresse: '', ville: '', contact: '', email: '',
    numero_rc: '', numero_cc: '', plafond_credit: 0, groupe: '', ...p,
  });

  it('retient ce qui a un nom', () => {
    const { valides, ignores } = preparerImportClients([ligne(), ligne({ raison_sociale: '  ' })], aucun);
    expect(valides).toHaveLength(1);
    expect(ignores[0]).toMatchObject({ ligne: 2, raison: 'nom vide' });
  });

  /*
   * Le cas qui compte : relancer le même fichier deux fois ne doit rien
   * ajouter et surtout pas doubler une créance. Le rapprochement se fait sur
   * le code quand il y en a un, sur le nom sinon — c'est tout ce qu'on a quand
   * le répertoire vient d'un cahier.
   */
  it('n’ajoute pas un client déjà au répertoire, par son code ou par son nom', () => {
    const existants = { codes: new Set(['CLI-001']), noms: new Set([cleTiers('Madame Adjoua')]) };
    const { valides, ignores } = preparerImportClients(
      [ligne({ code: 'CLI-001' }), ligne({ raison_sociale: 'MADAME ADJOUA' }), ligne({ raison_sociale: 'NOUVEAU' })],
      existants,
    );
    expect(valides.map((v) => v.raison_sociale)).toEqual(['NOUVEAU']);
    expect(ignores[0].raison).toMatch(/CLI-001 est déjà au répertoire/);
    expect(ignores[1].raison).toMatch(/déjà au répertoire/);
  });

  it('écarte les doublons internes au fichier', () => {
    const { valides, ignores } = preparerImportClients(
      [ligne({ code: 'A' }), ligne({ code: 'A', raison_sociale: 'AUTRE NOM' }), ligne({ raison_sociale: 'ETS KOUAME' })],
      aucun,
    );
    expect(valides).toHaveLength(1);
    expect(ignores.map((i) => i.raison)).toEqual([
      expect.stringMatching(/en double dans le fichier/),
      expect.stringMatching(/en double dans le fichier/),
    ]);
  });

  // La casse et les accents ne font pas deux clients différents.
  it('rapproche les noms sans se laisser prendre à la casse ni aux accents', () => {
    expect(cleTiers('Ets Kouamé & Fils')).toBe(cleTiers('ETS KOUAME FILS'));
    const { valides } = preparerImportClients([ligne({ raison_sociale: 'Ets Kouamé' })], { codes: new Set(), noms: new Set([cleTiers('ETS KOUAME')]) });
    expect(valides).toHaveLength(0);
  });

  it('met le code en majuscules et coupe les espaces du nom', () => {
    const { valides } = preparerImportClients([ligne({ code: ' cli-9 ', raison_sociale: '  ETS A  ' })], aucun);
    expect(valides[0]).toMatchObject({ code: 'CLI-9', raison_sociale: 'ETS A' });
  });
});
