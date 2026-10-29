import { describe, expect, it } from 'vitest';
import {
  brouillonFromRow, ecrireLignesBrouillon, libelleBrouillon, lireLignesBrouillon,
} from './brouillon';
import type { LignePanier } from './panier';

const ligne = (over: Partial<LignePanier> = {}): LignePanier => ({
  article_id: 'a1', code: 'CIM-50', designation: 'Ciment 50 kg', unite: 'SAC',
  prix_unitaire_ttc: 5900, tva_percent: 0, quantite: 2, remise_percent: 0, ...over,
});

describe('panier d’un brouillon', () => {
  it('fait l’aller-retour sans rien perdre', () => {
    const lignes = [ligne(), ligne({ article_id: 'a2', code: 'FER-12', designation: 'Fer 12', quantite: 5 })];
    expect(lireLignesBrouillon(ecrireLignesBrouillon(lignes))).toEqual(lignes);
  });

  // Un brouillon abîmé, ou écrit par une version plus récente, ne doit pas
  // faire tomber l'écran de caisse.
  it('ignore une ligne illisible plutôt que de tout perdre', () => {
    const json = JSON.stringify([ligne(), { article_id: '', quantite: 3 }, null, 'bruit', { quantite: 0, article_id: 'a3' }]);
    const lues = lireLignesBrouillon(json);
    expect(lues).toHaveLength(1);
    expect(lues[0]!.article_id).toBe('a1');
  });

  it('rend un panier vide sur un JSON cassé', () => {
    expect(lireLignesBrouillon('{ pas du json')).toEqual([]);
    expect(lireLignesBrouillon('{"lignes":[]}')).toEqual([]);
    expect(lireLignesBrouillon(null)).toEqual([]);
  });

  it('complète ce qui manque sans inventer de quantité', () => {
    const lues = lireLignesBrouillon(JSON.stringify([{ article_id: 'a9', quantite: 1 }]));
    expect(lues[0]).toMatchObject({ designation: 'Article', prix_unitaire_ttc: 0, tva_percent: 0, quantite: 1 });
  });
});

describe('brouillonFromRow', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'b1', libelle: 'Ciment 50 kg', filiale_id: 'f1', client_id: null,
    lignes: ecrireLignesBrouillon([ligne()]), remise: 500, remise_auto: 1,
    total_ttc: 11300, articles: 2, utilisateur_id: 'u1', poste: 'K7Q',
    created_at: '2026-10-29T08:00:00.000Z', updated_at: '2026-10-29T08:00:00.000Z',
    utilisateur_nom: 'Koné', utilisateur_prenom: 'Awa', ...over,
  } as never);

  it('relit la ligne telle que la base la rend', () => {
    const b = brouillonFromRow(row());
    expect(b).toMatchObject({ libelle: 'Ciment 50 kg', remise: 500, total_ttc: 11300, poste: 'K7Q', utilisateur: 'Awa Koné' });
    expect(b.lignes).toHaveLength(1);
  });

  // SQLite n'a pas de booléen : la colonne arrive en 0 / 1.
  it('lit le drapeau de remise automatique en 0 / 1', () => {
    expect(brouillonFromRow(row({ remise_auto: 0 })).remise_auto).toBe(false);
    expect(brouillonFromRow(row({ remise_auto: 1 })).remise_auto).toBe(true);
  });

  it('se passe de ce qui manque', () => {
    const b = brouillonFromRow(row({ libelle: null, remise: null, utilisateur_nom: null, utilisateur_prenom: null, poste: null }));
    expect(b).toMatchObject({ libelle: 'Ticket', remise: 0, utilisateur: null, poste: null });
  });
});

describe('libelleBrouillon', () => {
  it('prend le client quand il y en a un', () => {
    expect(libelleBrouillon([ligne()], { raison_sociale: 'ETS KOUAME' })).toBe('ETS KOUAME');
  });

  it('nomme le ticket par son contenu au comptoir', () => {
    expect(libelleBrouillon([ligne()], null)).toBe('Ciment 50 kg');
    expect(libelleBrouillon([ligne(), ligne({ article_id: 'a2' }), ligne({ article_id: 'a3' })], null)).toBe('Ciment 50 kg +2');
  });
});
