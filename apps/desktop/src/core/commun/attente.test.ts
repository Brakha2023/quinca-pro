import { describe, expect, it } from 'vitest';
import { libelleAttente, peindre } from './attente';

describe('libelleAttente', () => {
  it('met le verbe du bouton au travail', () => {
    expect(libelleAttente('Imprimer')).toBe('Impression…');
    expect(libelleAttente('Exporter Excel')).toBe('Export…');
    expect(libelleAttente("Valider l'entrée")).toBe('Validation…');
    expect(libelleAttente('Supprimer définitivement')).toBe('Suppression…');
    expect(libelleAttente('Encaisser')).toBe('Encaissement…');
  });

  it('ne se laisse pas prendre par la casse ni par la suite du libellé', () => {
    expect(libelleAttente('IMPRIMER / PDF')).toBe('Impression…');
    expect(libelleAttente('imprimer le bon BL-7')).toBe('Impression…');
  });

  /**
   * Un « Chargement… » générique effacerait ce sur quoi on vient de cliquer, et
   * deux boutons voisins au travail deviendraient indiscernables. Le libellé
   * d'origine reste donc, suivi des trois points.
   */
  it('garde le libellé d’origine quand le verbe lui est inconnu', () => {
    expect(libelleAttente('Relancer par e-mail')).toBe('Relancer par e-mail…');
    expect(libelleAttente('Recalculer')).toBe('Recalculer…');
  });

  it('a toujours quelque chose à dire', () => {
    expect(libelleAttente('')).toBe('Un instant…');
    expect(libelleAttente('   ')).toBe('Un instant…');
  });

  /** Un verbe n'est reconnu qu'en tête : « Ne pas imprimer » n'est pas « Imprimer ». */
  it('ne reconnaît le verbe qu’au début', () => {
    expect(libelleAttente('Ne pas imprimer')).toBe('Ne pas imprimer…');
  });
});

describe('peindre', () => {
  it('rend la main, et sans erreur là où le navigateur n’existe pas', async () => {
    await expect(peindre()).resolves.toBeUndefined();
  });
});
