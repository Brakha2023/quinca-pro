import { describe, expect, it } from 'vitest';
import {
  echecFromRow,
  estEchecDefinitif,
  libelleTable,
  motifEchec,
  resumeEchec,
  type EchecEnvoiRow,
} from './echecEnvoi';

const erreur = (code: string, message = 'refus') => ({ code, message });

describe('estEchecDefinitif', () => {
  it('met de côté ce que le rejeu ne corrigera jamais', () => {
    expect(estEchecDefinitif(erreur('23505'))).toBe(true); // doublon de numéro
    expect(estEchecDefinitif(erreur('23503'))).toBe(true); // clé étrangère
    expect(estEchecDefinitif(erreur('23502'))).toBe(true); // champ obligatoire
    // `22P02` porte une lettre : un motif en `\d{3}` l'aurait cru réparable.
    expect(estEchecDefinitif(erreur('22P02'))).toBe(true); // texte invalide pour le type
    expect(estEchecDefinitif(erreur('42501'))).toBe(true); // RLS
  });

  it('laisse PowerSync réessayer tout ce qui est réparable côté serveur', () => {
    expect(estEchecDefinitif(erreur('42703'))).toBe(false); // colonne absente : migration en retard
    expect(estEchecDefinitif(erreur('PGRST205'))).toBe(false); // table absente
    expect(estEchecDefinitif(erreur('53300'))).toBe(false); // trop de connexions
    expect(estEchecDefinitif(new Error('Failed to fetch'))).toBe(false); // réseau
    expect(estEchecDefinitif(null)).toBe(false);
    expect(estEchecDefinitif({ code: '' })).toBe(false);
  });
});

describe('motifEchec', () => {
  it('traduit le code du serveur en phrase utile', () => {
    expect(motifEchec(erreur('23505', 'duplicate key value violates unique constraint "ventes_filiale_id_numero_key"'))).toEqual({
      code: '23505',
      message: 'duplicate key value violates unique constraint "ventes_filiale_id_numero_key"',
      explication: 'Doublon : une ligne porte déjà ce numéro, ce code ou cette référence sur le serveur.',
    });
    expect(motifEchec(erreur('42501')).explication).toContain('Droits insuffisants');
    expect(motifEchec(erreur('23999')).explication).toContain('contrainte du serveur');
    expect(motifEchec(erreur('22007')).explication).toContain('mal formée');
  });

  it('reste lisible sans code ni message', () => {
    expect(motifEchec({})).toEqual({ code: null, message: 'Refus du serveur sans message', explication: 'Refus définitif du serveur.' });
  });
});

describe('echecFromRow', () => {
  const row = (over: Partial<EchecEnvoiRow> = {}): EchecEnvoiRow => ({
    id: 'e1', lot: '12', table_cible: 'ventes', ligne_id: 'v1', operation: 'PUT',
    donnees: '{"numero":"C01-K7Q-20260922-M3Q2PT","total_ttc":59000}',
    code: '23505', motif: 'duplicate key', explication: 'Doublon', tentatives: 2,
    date_echec: '2026-10-17T09:00:00.000Z', utilisateur_id: 'u1', ...over,
  });

  it('relit les données envoyées', () => {
    expect(echecFromRow(row()).donnees).toEqual({ numero: 'C01-K7Q-20260922-M3Q2PT', total_ttc: 59000 });
  });

  it('survit à un contenu illisible ou vide', () => {
    expect(echecFromRow(row({ donnees: 'pas du json' })).donnees).toBeNull();
    expect(echecFromRow(row({ donnees: null })).donnees).toBeNull();
    expect(echecFromRow(row({ donnees: '"texte"' })).donnees).toBeNull();
  });

  it('résume l’écriture en clair', () => {
    expect(resumeEchec(echecFromRow(row()))).toBe('Création · Vente');
    expect(resumeEchec(echecFromRow(row({ operation: 'DELETE', table_cible: 'mouvements_stock' })))).toBe('Suppression · Mouvement de stock');
  });

  it('nomme même une table sans libellé dédié', () => {
    expect(libelleTable('bons_livraison')).toBe('Bons livraison');
  });
});
