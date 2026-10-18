import { describe, expect, it } from 'vitest';
import { colonneAbsente, desaccordSchema, fluxManquants, titreDesaccord, verdictDepuisErreur } from './schema';

describe('verdictDepuisErreur', () => {
  it('reconnaît une colonne absente et la nomme', () => {
    const v = verdictDepuisErreur('mouvements_stock', {
      code: '42703',
      message: 'column mouvements_stock.remise_percent does not exist',
    });
    expect(v).toEqual({
      table: 'mouvements_stock',
      etat: 'COLONNE_ABSENTE',
      colonne: 'remise_percent',
      message: 'column mouvements_stock.remise_percent does not exist',
    });
  });

  it('reconnaît une table absente', () => {
    expect(verdictDepuisErreur('ventes', { code: 'PGRST205', message: 'Could not find the table' }).etat).toBe('TABLE_ABSENTE');
    expect(verdictDepuisErreur('ventes', { code: '42P01', message: 'relation does not exist' }).etat).toBe('TABLE_ABSENTE');
  });

  it('ne confond pas un refus de droits avec un désaccord de schéma', () => {
    expect(verdictDepuisErreur('ventes', { code: '42501', message: 'permission denied' }).etat).toBe('REFUS');
  });

  it('pas d’erreur, pas de désaccord', () => {
    expect(verdictDepuisErreur('ventes', null)).toEqual({ table: 'ventes', etat: 'OK' });
  });
});

describe('colonneAbsente', () => {
  it('lit le nom dans les formes connues du message', () => {
    expect(colonneAbsente('column ventes.remise_percent does not exist', 'ventes')).toBe('remise_percent');
    expect(colonneAbsente('column "ventes.remise_percent" does not exist', 'ventes')).toBe('remise_percent');
    expect(colonneAbsente('column "depuis" does not exist', 'ventes')).toBe('depuis');
  });

  it('ne rend rien plutôt qu’un nom inventé', () => {
    expect(colonneAbsente('quelque chose d’autre', 'ventes')).toBeNull();
    expect(colonneAbsente(null, 'ventes')).toBeNull();
  });
});

describe('desaccordSchema', () => {
  it('se tait quand tout concorde', () => {
    expect(desaccordSchema([{ table: 'ventes', etat: 'OK' }], [])).toBeNull();
  });

  it('range une colonne absente dans les bloquants, en la nommant', () => {
    const d = desaccordSchema([{ table: 'mouvements_stock', etat: 'COLONNE_ABSENTE', colonne: 'remise_percent' }], [])!;
    expect(d.bloquants).toEqual(["« mouvements_stock » n'a pas la colonne « remise_percent » sur le serveur"]);
    expect(titreDesaccord(d)).toContain('pas le même schéma');
  });

  it('un flux absent se signale sans bloquer la saisie', () => {
    const d = desaccordSchema([{ table: 'ventes', etat: 'OK' }], ['activite'])!;
    expect(d.bloquants).toEqual([]);
    expect(d.remarques[0]).toContain('activite');
    expect(titreDesaccord(d)).toBe('Vérification du serveur incomplète');
  });
});

describe('fluxManquants', () => {
  it('compare ce qu’on attend à ce que le service sert', () => {
    expect(fluxManquants(['referentiel', 'activite'], ['referentiel'])).toEqual(['activite']);
    expect(fluxManquants(['referentiel', 'activite'], ['activite', 'referentiel', 'autre'])).toEqual([]);
  });
});
