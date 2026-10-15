import { describe, expect, it } from 'vitest';
import { depuisMaintenant, etatSynchronisation, type StatutSync } from './etatSynchronisation';

const statut = (over: Partial<StatutSync> = {}): StatutSync => ({
  connected: true, connecting: false, uploading: false, downloading: false, ...over,
});
const maintenant = new Date('2026-10-15T12:00:00Z');

describe('etatSynchronisation', () => {
  it('signale une file bloquée plutôt que d’afficher « Synchronisé »', () => {
    const e = etatSynchronisation(statut({ uploadError: new Error("column mouvements_stock.remise_percent does not exist") }), 7, maintenant);
    expect(e.nature).toBe('BLOQUE');
    expect(e.label).toBe('Envoi bloqué · 7 en attente');
    expect(e.detail).toContain('remise_percent');
    expect(e.detail).toContain('restent sur ce poste');
  });

  it('ne crie pas sur une erreur passagère sans rien en attente', () => {
    expect(etatSynchronisation(statut({ uploadError: new Error('réseau') }), 0, maintenant).nature).toBe('A_JOUR');
  });

  it('le blocage prime sur tout le reste, même pendant un échange', () => {
    expect(etatSynchronisation(statut({ uploading: true, uploadError: new Error('x') }), 3, maintenant).nature).toBe('BLOQUE');
  });

  it('distingue connexion, échange et à jour', () => {
    expect(etatSynchronisation(statut({ connected: false, connecting: true }), 0, maintenant).nature).toBe('CONNEXION');
    expect(etatSynchronisation(statut({ downloading: true }), 0, maintenant).label).toBe('Réception…');
    expect(etatSynchronisation(statut({ uploading: true }), 0, maintenant).label).toBe('Envoi…');
    expect(etatSynchronisation(statut({ lastSyncedAt: new Date('2026-10-15T11:30:00Z') }), 0, maintenant).label).toBe('Synchronisé il y a 30 min');
  });

  it('hors ligne avec des écritures en attente reste « hors ligne » : c’est le fonctionnement normal', () => {
    const e = etatSynchronisation(statut({ connected: false, uploadError: new Error('fetch failed') }), 12, maintenant);
    expect(e.nature).toBe('HORS_LIGNE');
  });

  it('hors ligne, rappelle la dernière synchronisation', () => {
    const e = etatSynchronisation(statut({ connected: false, lastSyncedAt: new Date('2026-10-15T10:00:00Z') }), 2, maintenant);
    expect(e.nature).toBe('HORS_LIGNE');
    expect(e.label).toBe('Hors ligne · dernière sync il y a 2 h');
  });

  it('hors ligne sans historique', () => {
    expect(etatSynchronisation(statut({ connected: false }), 0, maintenant).label).toBe('Hors ligne');
  });
});

describe('depuisMaintenant', () => {
  it('arrondit en minutes puis en heures', () => {
    expect(depuisMaintenant(new Date('2026-10-15T11:59:40Z'), maintenant)).toBe("à l'instant");
    expect(depuisMaintenant(new Date('2026-10-15T11:45:00Z'), maintenant)).toBe('il y a 15 min');
    expect(depuisMaintenant(new Date('2026-10-15T09:00:00Z'), maintenant)).toBe('il y a 3 h');
  });
});
