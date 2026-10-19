import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { RoleRow } from '@quinca/shared-types';
import {
  peut as peutCore, peutUneDe as peutUneDeCore, permissionsDeSecours, roleFromRow,
  type Permission, type Role,
} from '../../core/parametres';
import {
  PERMISSIONS_UTILISATEUR_QUERY, ROLE_COURANT_QUERY,
} from '../../infrastructure/powersync/repositories/RolesRepository';
import { useAuth } from './useAuth';
import { useCurrentUtilisateur } from './useCurrentUtilisateur';

/** Pourquoi les permissions ne viennent pas du rôle. */
export type MotifSecours =
  /** La table des rôles n'est pas (encore) sur ce poste. */
  | 'ROLES_ABSENTS'
  /** Les rôles sont là, mais celui du compte n'y est pas — ou aucun ne lui a été affecté. */
  | 'SANS_ROLE';

export interface PermissionsCourantes {
  /** Vraie question à poser partout : « a-t-il le droit de… ? » */
  peut: (permission: Permission) => boolean;
  peutUneDe: (permissions: Permission[]) => boolean;
  permissions: string[];
  role: Role | null;
  estSuperadmin: boolean;
  /** Le rôle n'est pas encore lu : on ne refuse pas, on attend. */
  isLoading: boolean;
  /**
   * Les permissions ne viennent pas d'un rôle mais du profil, faute de mieux.
   * Nul quand tout va bien.
   */
  secours: MotifSecours | null;
}

/**
 * Permissions de l'utilisateur qui travaille sur le poste, lues dans la base
 * locale : l'application reste entière hors ligne, rôle compris.
 *
 * Un rôle désactivé, ou un compte désactivé, ne rend aucune permission — la
 * requête l'exclut, comme le fait `a_permission()` côté serveur.
 *
 * **Si le rôle manque, on ne ferme pas l'application** : on retombe sur les
 * permissions du profil, et l'écran le dit. Les rôles arrivent par la
 * synchronisation ; un poste neuf, ou des règles de synchronisation pas encore
 * déployées, ne doivent pas laisser un gérant devant un écran vide.
 */
export function usePermissions(): PermissionsCourantes {
  const { utilisateurId } = useAuth();
  const { utilisateur } = useCurrentUtilisateur();

  const { data: roles, isLoading: roleEnCours } = useQuery<RoleRow>(ROLE_COURANT_QUERY, [utilisateurId ?? '']);
  const { data: lignes, isLoading: permissionsEnCours } = useQuery<{ permission: string | null }>(
    PERMISSIONS_UTILISATEUR_QUERY,
    [utilisateurId ?? ''],
  );
  // Distinguer « les rôles ne sont pas arrivés » de « ce compte n'en a pas » :
  // les deux se soignent autrement, et le message doit dire lequel c'est.
  const { data: compte, isLoading: compteEnCours } = useQuery<{ n: number }>('SELECT COUNT(*) AS n FROM roles');

  const role = useMemo(() => (roles[0] ? roleFromRow(roles[0]) : null), [roles]);
  const accordees = useMemo(
    () => lignes.map((l) => l.permission).filter((p): p is string => Boolean(p)),
    [lignes],
  );

  const isLoading = roleEnCours || permissionsEnCours || compteEnCours;
  const aucunRoleConnu = (compte[0]?.n ?? 0) === 0;

  return useMemo(() => {
    const secours: MotifSecours | null = role || isLoading ? null : aucunRoleConnu ? 'ROLES_ABSENTS' : 'SANS_ROLE';
    const permissions = secours ? [...permissionsDeSecours(utilisateur?.profil ?? 'CAISSIER')] : accordees;
    const estSuperadmin = role?.est_superadmin ?? false;

    return {
      peut: (permission: Permission) => peutCore(permissions, permission, estSuperadmin),
      peutUneDe: (liste: Permission[]) => peutUneDeCore(permissions, liste, estSuperadmin),
      permissions,
      role,
      estSuperadmin,
      isLoading,
      secours,
    };
  }, [accordees, role, isLoading, aucunRoleConnu, utilisateur?.profil]);
}
