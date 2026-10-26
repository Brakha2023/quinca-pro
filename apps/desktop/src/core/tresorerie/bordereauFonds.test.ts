import { describe, expect, it } from 'vitest';
import { construireBordereauFonds, type EnteteTransfertFonds } from './bordereauFonds';

const entete = (p: Partial<EnteteTransfertFonds> = {}): EnteteTransfertFonds => ({
  numero: 'TRF-2026-0007',
  statut: 'EN_TRANSIT',
  date_envoi: '2026-10-26T08:30:00.000Z',
  date_reception: null,
  montant: 60_000,
  motif: 'Appro. caisse Bouaké',
  filiale_source_nom: 'Filiale Abidjan',
  filiale_destination_nom: 'Filiale Bouaké',
  caisse_source_nom: 'Caisse principale',
  caisse_destination_nom: null,
  utilisateur_envoi: 'Awa Koné',
  utilisateur_reception: null,
  ...p,
});

describe('bordereau de transfert de fonds', () => {
  it('porte le montant en toutes lettres : c’est lui qui fait foi', () => {
    expect(construireBordereauFonds(entete()).montant_en_lettres).toBe('soixante mille francs CFA');
  });

  it('annonce que les fonds sont en route tant que personne n’a encaissé', () => {
    const b = construireBordereauFonds(entete());
    expect(b.mention).toContain('en route');
    expect(b.sans_valeur).toBe(false);
    expect(b.caisse_destination).toBeNull();
  });

  it('dit où et quand les fonds ont été encaissés', () => {
    const b = construireBordereauFonds(entete({
      statut: 'RECU',
      date_reception: '2026-10-26T15:45:00.000Z',
      caisse_destination_nom: 'Caisse Bouaké',
      utilisateur_reception: 'Kouassi Yao',
    }));
    expect(b.mention).toContain('Caisse Bouaké');
    expect(b.receptionnaire).toBe('Kouassi Yao');
    expect(b.sans_valeur).toBe(false);
  });

  // Un bordereau annulé a pu circuler : il reste imprimable pour le classement,
  // mais rien ne doit permettre de remettre de l'argent contre lui.
  it('marque la pièce annulée comme ne valant pas remise de fonds', () => {
    const b = construireBordereauFonds(entete({ statut: 'ANNULE' }));
    expect(b.sans_valeur).toBe(true);
    expect(b.mention).toContain('ne vaut pas remise de fonds');
  });

  // Côté expéditeur, le poste ne synchronise ni les caisses ni les utilisateurs
  // d'en face : la pièce doit sortir quand même.
  it('s’imprime avec ce qu’il a quand l’autre bout manque', () => {
    const b = construireBordereauFonds(entete({
      numero: null, statut: null, montant: null,
      filiale_destination_nom: null, caisse_source_nom: null, utilisateur_envoi: null,
    }));
    expect(b.numero).toBe('—');
    expect(b.statut).toBe('EN_TRANSIT');
    expect(b.filiale_destination).toBe('—');
    expect(b.caisse_source).toBe('—');
    expect(b.operateur).toBe('—');
    expect(b.montant).toBe(0);
  });
});
