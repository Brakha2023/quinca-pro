import { describe, expect, it } from 'vitest';
import type { Cellule } from '../articles';
import { cleTiers } from '../commun/importTiers';
import {
  EntetesFournisseurIntrouvablesError, fournisseursDepuisGrille,
  preparerImportFournisseurs, trouverEnteteFournisseur, type LigneImportFournisseur,
} from './importFournisseurs';

/** Un relevé tel qu'on le reçoit : un titre, les entêtes, les comptes, un total. */
const RELEVE: Cellule[][] = [
  ['BALANCE FOURNISSEURS AU 31/12/2026', null, null, null],
  ['CODE', 'RAISON SOCIALE', 'A PAYER', 'ARRETE AU'],
  ['FOU-001', 'SOCIMAT CI', '425 000', '31/12/2026'],
  [null, 'QUINCAILLERIE DU PONT', -50000, '31/12/2026'],
  ['TOTAL', null, 375000, null],
];

const aucun = { codes: new Set<string>(), noms: new Set<string>() };

describe('trouverEnteteFournisseur', () => {
  it('trouve les entêtes sous le titre', () => {
    expect(trouverEnteteFournisseur(RELEVE)).toMatchObject({
      ligne: 1,
      colonnes: { code: 0, raison_sociale: 1, solde_initial: 2, date_effet_solde: 3 },
    });
  });

  /*
   * Un relevé de fournisseur dit « DETTE » ou « À PAYER » là où un fichier de
   * clients disait « CRÉANCE » : les deux désignent le solde d'ouverture,
   * chacun de son côté du compte.
   */
  it('reconnaît le vocabulaire du compte fournisseur', () => {
    expect(trouverEnteteFournisseur([['Fournisseur', 'Dette']])?.colonnes).toEqual({ raison_sociale: 0, solde_initial: 1 });
    expect(trouverEnteteFournisseur([['Nom', 'À payer']])?.colonnes).toEqual({ raison_sociale: 0, solde_initial: 1 });
  });

  it('rend null quand aucune colonne ne nomme le fournisseur', () => {
    expect(trouverEnteteFournisseur([['Quantité', 'Dépôt']])).toBeNull();
  });
});

describe('fournisseursDepuisGrille', () => {
  it('ne perd aucun compte et écarte titre et total', () => {
    const lignes = fournisseursDepuisGrille(RELEVE);
    expect(lignes).toHaveLength(2);
    expect(lignes[0]).toMatchObject({
      code: 'FOU-001', raison_sociale: 'SOCIMAT CI', solde_initial: 425000, date_effet_solde: '2026-12-31',
    });
  });

  // Positif : la maison doit. Négatif : une avance déjà versée au fournisseur.
  it('garde le signe du solde', () => {
    expect(fournisseursDepuisGrille(RELEVE)[1]).toMatchObject({ raison_sociale: 'QUINCAILLERIE DU PONT', solde_initial: -50000, code: '' });
  });

  it('refuse un fichier sans entêtes, en disant lesquels', () => {
    expect(() => fournisseursDepuisGrille([['Quantité'], ['3']])).toThrow(EntetesFournisseurIntrouvablesError);
    expect(() => fournisseursDepuisGrille([['Quantité'], ['3']])).toThrow(/RAISON SOCIALE/);
  });

  it('remplit ce qui manque sans inventer', () => {
    const [f] = fournisseursDepuisGrille([['NOM'], ['FOURNISSEUR SANS RIEN']]);
    expect(f).toEqual({
      code: '', raison_sociale: 'FOURNISSEUR SANS RIEN', solde_initial: 0, date_effet_solde: '',
      mobile: '', telephone: '', adresse: '', email: '', interlocuteur: '', mobile_interlocuteur: '',
      numero_rc: '', numero_cc: '', famille: '', banque: '', numero_compte_bancaire: '',
    });
  });

  it('reprend l’interlocuteur et la banque quand le fichier les porte', () => {
    const [f] = fournisseursDepuisGrille([
      ['Nom', 'Représentant', 'Banque', 'RIB'],
      ['SOCIMAT CI', 'M. Diarra', 'SGBCI', 'CI00012345'],
    ]);
    expect(f).toMatchObject({ interlocuteur: 'M. Diarra', banque: 'SGBCI', numero_compte_bancaire: 'CI00012345' });
  });
});

describe('preparerImportFournisseurs', () => {
  const ligne = (p: Partial<LigneImportFournisseur> = {}): LigneImportFournisseur => ({
    code: '', raison_sociale: 'SOCIMAT CI', solde_initial: 0, date_effet_solde: '',
    mobile: '', telephone: '', adresse: '', email: '', interlocuteur: '', mobile_interlocuteur: '',
    numero_rc: '', numero_cc: '', famille: '', banque: '', numero_compte_bancaire: '', ...p,
  });

  /*
   * Le cas qui compte : relancer le même fichier deux fois ne doit rien
   * ajouter et surtout pas doubler une dette.
   */
  it('n’ajoute pas un fournisseur déjà au répertoire, par son code ou par son nom', () => {
    const existants = { codes: new Set(['FOU-001']), noms: new Set([cleTiers('Quincaillerie du Pont')]) };
    const { valides, ignores } = preparerImportFournisseurs(
      [ligne({ code: 'FOU-001' }), ligne({ raison_sociale: 'QUINCAILLERIE DU PONT' }), ligne({ raison_sociale: 'NOUVEAU' })],
      existants,
    );
    expect(valides.map((v) => v.raison_sociale)).toEqual(['NOUVEAU']);
    expect(ignores[0].raison).toMatch(/FOU-001 est déjà au répertoire/);
    expect(ignores[1].raison).toMatch(/déjà au répertoire/);
  });

  it('écarte les doublons internes au fichier', () => {
    const { valides, ignores } = preparerImportFournisseurs(
      [ligne({ code: 'A' }), ligne({ code: 'A', raison_sociale: 'AUTRE' }), ligne()],
      aucun,
    );
    expect(valides).toHaveLength(1);
    expect(ignores).toHaveLength(2);
  });

  it('retient ce qui a un nom', () => {
    const { valides, ignores } = preparerImportFournisseurs([ligne(), ligne({ raison_sociale: '  ' })], aucun);
    expect(valides).toHaveLength(1);
    expect(ignores[0]).toMatchObject({ ligne: 2, raison: 'nom vide' });
  });
});
