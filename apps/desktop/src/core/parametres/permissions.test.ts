import { describe, expect, it } from 'vitest';
import {
  CATALOGUE_PERMISSIONS, PERMISSIONS, estPermission, libellePermission, modulePermission,
  permissionsParModule, peut, peutUneDe,
} from './permissions';

describe('catalogue', () => {
  it('ne contient aucun doublon', () => {
    expect(new Set(PERMISSIONS).size).toBe(PERMISSIONS.length);
  });

  it('nomme chaque permission « module.action », en minuscules', () => {
    for (const code of PERMISSIONS) expect(code).toMatch(/^[a-z_]+\.[a-z_]+$/);
  });

  it('donne à chaque permission un libellé lisible', () => {
    for (const module of CATALOGUE_PERMISSIONS) {
      expect(module.libelle.length).toBeGreaterThan(2);
      for (const p of module.permissions) expect(p.libelle.length).toBeGreaterThan(5);
    }
  });

  it('couvre les onze modules de l’application', () => {
    expect(CATALOGUE_PERMISSIONS.map((m) => m.id)).toEqual([
      'pilotage', 'vente', 'catalogue', 'stock', 'clients', 'fournisseurs',
      'tresorerie', 'livraisons', 'personnel', 'surveillance', 'parametres',
    ]);
  });

  it('garde les trois vérifications qui existaient en dur dans l’interface', () => {
    // Avant les rôles, ces trois-là étaient écrites `profil === 'GERANT' || 'DIRECTEUR'`.
    expect(estPermission('ventes.valider')).toBe(true);
    expect(estPermission('ventes.forcer_stock')).toBe(true);
    expect(estPermission('sync.decider')).toBe(true);
  });

  it('ne reconnaît pas un code inventé', () => {
    expect(estPermission('ventes.supprimer_tout')).toBe(false);
  });

  it('retrouve le module d’une permission', () => {
    expect(modulePermission('stock.inventaire')?.id).toBe('stock');
    expect(modulePermission('inconnue.chose')).toBeUndefined();
  });

  it('affiche le code lui-même quand cette version ignore la permission', () => {
    expect(libellePermission('stock.inventaire')).toBe('Saisir un inventaire');
    expect(libellePermission('futur.module')).toBe('futur.module');
  });
});

describe('peut', () => {
  const accordees = ['pos.encaisser', 'ventes.lire'];

  it('répond sur ce qui est accordé, et seulement là', () => {
    expect(peut(accordees, 'pos.encaisser')).toBe(true);
    expect(peut(accordees, 'ventes.valider')).toBe(false);
  });

  it('accorde tout au superadministrateur, y compris ce qu’il n’a pas en ligne', () => {
    expect(peut([], 'parametres.roles', true)).toBe(true);
    expect(peut([], 'permission.future', true)).toBe(true);
  });

  it('accepte un ensemble aussi bien qu’une liste', () => {
    expect(peut(new Set(accordees), 'ventes.lire')).toBe(true);
  });

  it('ouvre un écran dès qu’une des permissions attendues est là', () => {
    expect(peutUneDe(accordees, ['ventes.valider', 'ventes.lire'])).toBe(true);
    expect(peutUneDe(accordees, ['ventes.valider', 'ventes.annuler'])).toBe(false);
    expect(peutUneDe([], ['ventes.valider'], true)).toBe(true);
  });
});

describe('permissionsParModule', () => {
  it('groupe par module et laisse de côté les modules vides', () => {
    const groupes = permissionsParModule(['pos.encaisser', 'stock.lire', 'stock.entree']);
    expect(groupes.map((g) => g.module.id)).toEqual(['vente', 'stock']);
    expect(groupes[1]!.permissions.map((p) => p.code)).toEqual(['stock.lire', 'stock.entree']);
  });

  it('écarte un code que cette version ne connaît pas', () => {
    // Un poste resté en version ancienne reçoit les permissions d'une version
    // plus récente : il doit les ignorer, pas afficher un code nu.
    const groupes = permissionsParModule(['stock.lire', 'futur.module']);
    expect(groupes.flatMap((g) => g.permissions.map((p) => p.code))).toEqual(['stock.lire']);
  });
});
