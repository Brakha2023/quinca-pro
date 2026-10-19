import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from './permissions';
import {
  PORTEES, ROLES_SYSTEME, codeModifiable, libellePortee, matricePermissions, motifNonSupprimable,
  normaliserCodeRole, permissionsModifiables, porteeModifiable, recapRoles, roleDesactivable,
  roleFormSchema, roleFromRow, roleSansFiliale, type Role,
} from './roles';

const role = (p: Partial<Role> = {}): Role => ({
  id: 'r1', code: 'role_chef_rayon', nom: 'Chef de rayon', description: null,
  profil: 'MAGASINIER', est_systeme: false, est_superadmin: false, est_actif: true, ...p,
});

describe('normaliserCodeRole', () => {
  it('dérive le code technique du nom que le gérant tape', () => {
    expect(normaliserCodeRole('Chef de rayon')).toBe('role_chef_de_rayon');
    expect(normaliserCodeRole('Gestionnaire')).toBe('role_gestionnaire');
  });

  it('enlève les accents, que le serveur refuse', () => {
    expect(normaliserCodeRole('Préparateur de commandes')).toBe('role_preparateur_de_commandes');
    expect(normaliserCodeRole('Contrôleur')).toBe('role_controleur');
  });

  it('ne laisse ni ponctuation, ni blanc de bordure', () => {
    expect(normaliserCodeRole('  Chef / Adjoint !  ')).toBe('role_chef_adjoint');
  });

  it('ne rend rien d’un nom qui ne contient aucune lettre', () => {
    expect(normaliserCodeRole('???')).toBe('');
  });
});

describe('roleFromRow', () => {
  it('lit les drapeaux SQLite comme des booléens', () => {
    expect(roleFromRow({
      id: 'r1', code: 'role_superadmin', nom: 'Superadministrateur', description: null, profil: 'DIRECTEUR',
      est_systeme: 1, est_superadmin: 1, est_actif: 1, created_at: null, updated_at: null,
    })).toMatchObject({ est_systeme: true, est_superadmin: true, est_actif: true });
  });

  it('tient un rôle pour actif tant qu’on ne l’a pas désactivé', () => {
    const r = roleFromRow({
      id: 'r2', code: 'role_x', nom: 'X', description: null, profil: null,
      est_systeme: null, est_superadmin: null, est_actif: null, created_at: null, updated_at: null,
    });
    expect(r.est_actif).toBe(true);
    expect(r.est_systeme).toBe(false);
  });
});

describe('ce qu’on fait, ou non, à un rôle', () => {
  it('fige le code et la portée d’un rôle livré, jamais son nom ni ses permissions', () => {
    const systeme = role({ est_systeme: true });
    expect(codeModifiable(systeme)).toBe(false);
    expect(porteeModifiable(systeme)).toBe(false);
    expect(permissionsModifiables(systeme)).toBe(true);
  });

  it('laisse tout modifier d’un rôle sur mesure', () => {
    expect(codeModifiable(role())).toBe(true);
    expect(porteeModifiable(role())).toBe(true);
  });

  it('ne retire rien au superadministrateur, et ne le désactive pas', () => {
    const superadmin = role({ est_superadmin: true, est_systeme: true });
    expect(permissionsModifiables(superadmin)).toBe(false);
    expect(roleDesactivable(superadmin)).toBe(false);
  });

  it('dit pourquoi un rôle ne se supprime pas, et quoi faire', () => {
    expect(motifNonSupprimable(role({ est_systeme: true }), 0)).toContain('désactiver');
    expect(motifNonSupprimable(role(), 3)).toContain('3 utilisateur(s)');
    expect(motifNonSupprimable(role(), 0)).toBeNull();
  });
});

describe('portée', () => {
  it('n’attache aucune filiale à un rôle de direction', () => {
    expect(roleSansFiliale({ profil: 'DIRECTEUR' })).toBe(true);
    expect(roleSansFiliale({ profil: 'GERANT' })).toBe(false);
  });

  it('dit la portée comme on la dit à l’oral', () => {
    expect(libellePortee('DIRECTEUR')).toBe('Toutes les filiales');
    expect(PORTEES).toHaveLength(4);
  });
});

describe('roleFormSchema', () => {
  it('exige un nom et une portée', () => {
    expect(roleFormSchema.safeParse({ nom: 'A', profil: 'GERANT' }).success).toBe(false);
    expect(roleFormSchema.safeParse({ nom: 'Chef de rayon', profil: 'MAGASINIER' }).success).toBe(true);
  });

  it('refuse une portée inventée', () => {
    expect(roleFormSchema.safeParse({ nom: 'Chef de rayon', profil: 'PATRON' }).success).toBe(false);
  });
});

describe('recapRoles', () => {
  it('compte les rôles, ceux qu’on a créés et ceux que personne ne porte', () => {
    expect(recapRoles([
      { ...role({ id: 'a', est_systeme: true }), porteurs: 2 },
      { ...role({ id: 'b' }), porteurs: 0 },
      { ...role({ id: 'c', est_actif: false }), porteurs: 0 },
    ])).toEqual({ nombre: 3, actifs: 2, sur_mesure: 2, sans_porteur: 2 });
  });
});

describe('ROLES_SYSTEME', () => {
  it('décrit les cinq rôles que la migration pose', () => {
    expect(ROLES_SYSTEME.map((r) => r.code)).toEqual([
      'role_superadmin', 'role_directeur', 'role_gestionnaire', 'role_caissier', 'role_magasinier',
    ]);
  });

  it('ne liste aucune permission au superadministrateur : il a tout par nature', () => {
    expect(ROLES_SYSTEME[0]!.permissions).toBe('*');
  });

  it('n’accorde la définition des rôles à personne d’autre que lui', () => {
    for (const r of ROLES_SYSTEME.slice(1)) {
      expect(r.permissions).not.toContain('parametres.roles');
    }
  });

  it('ne nomme que des permissions du catalogue', () => {
    for (const r of ROLES_SYSTEME) {
      if (r.permissions === '*') continue;
      for (const p of r.permissions) expect(PERMISSIONS).toContain(p);
    }
  });

  it('laisse un caissier encaisser sans rien valider', () => {
    const caissier = ROLES_SYSTEME.find((r) => r.code === 'role_caissier')!.permissions as readonly string[];
    expect(caissier).toContain('pos.encaisser');
    expect(caissier).not.toContain('ventes.valider');
    expect(caissier).not.toContain('ventes.forcer_stock');
  });

  it('laisse un magasinier tenir le stock sans voir la trésorerie', () => {
    const magasinier = ROLES_SYSTEME.find((r) => r.code === 'role_magasinier')!.permissions as readonly string[];
    expect(magasinier).toContain('stock.inventaire');
    expect(magasinier).toContain('stock.transferer_filiale');
    expect(magasinier).not.toContain('tresorerie.lire');
  });
});

describe('matricePermissions', () => {
  const roles = [role({ id: 'sa', est_superadmin: true }), role({ id: 'cai' })];
  const accordees = new Map([['cai', new Set(['pos.encaisser'])]]);

  it('donne une ligne par permission du catalogue', () => {
    expect(matricePermissions(roles, accordees)).toHaveLength(PERMISSIONS.length);
  });

  it('coche tout pour le superadministrateur, et le reste à la ligne', () => {
    const lignes = matricePermissions(roles, accordees);
    const encaisser = lignes.find((l) => l.permission.code === 'pos.encaisser')!;
    const valider = lignes.find((l) => l.permission.code === 'ventes.valider')!;
    expect(encaisser.detenue).toEqual([true, true]);
    expect(valider.detenue).toEqual([true, false]);
  });

  it('nomme le module de chaque ligne, pour l’impression', () => {
    const ligne = matricePermissions(roles, accordees).find((l) => l.permission.code === 'stock.lire')!;
    expect(ligne.module).toBe('Stock');
  });
});
