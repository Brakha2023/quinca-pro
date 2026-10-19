import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { RoleRow } from '@quinca/shared-types';
import { peut as peutCore, peutUneDe as peutUneDeCore, roleFromRow, type Permission, type Role } from '../../core/parametres';
import {
  PERMISSIONS_UTILISATEUR_QUERY, ROLE_COURANT_QUERY,
} from '../../infrastructure/powersync/repositories/RolesRepository';
import { useAuth } from './useAuth';

export interface PermissionsCourantes {
  /** Vraie question à poser partout : « a-t-il le droit de… ? » */
  peut: (permission: Permission) => boolean;
  peutUneDe: (permissions: Permission[]) => boolean;
  permissions: string[];
  role: Role | null;
  estSuperadmin: boolean;
  /** Le rôle n'est pas encore descendu sur le poste : on ne refuse pas, on attend. */
  isLoading: boolean;
  /** Aucun rôle affecté : le compte existe mais ne peut rien faire. */
  sansRole: boolean;
}

/**
 * Permissions de l'utilisateur qui travaille sur le poste, lues dans la base
 * locale : l'application reste entière hors ligne, rôle compris.
 *
 * Un rôle désactivé, ou un compte désactivé, ne rend aucune permission — la
 * requête l'exclut, comme le fait `a_permission()` côté serveur.
 */
export function usePermissions(): PermissionsCourantes {
  const { utilisateurId } = useAuth();

  const { data: roles, isLoading: roleEnCours } = useQuery<RoleRow>(ROLE_COURANT_QUERY, [utilisateurId ?? '']);
  const { data: lignes, isLoading: permissionsEnCours } = useQuery<{ permission: string | null }>(
    PERMISSIONS_UTILISATEUR_QUERY,
    [utilisateurId ?? ''],
  );

  const role = useMemo(() => (roles[0] ? roleFromRow(roles[0]) : null), [roles]);
  const permissions = useMemo(
    () => lignes.map((l) => l.permission).filter((p): p is string => Boolean(p)),
    [lignes],
  );

  const estSuperadmin = role?.est_superadmin ?? false;
  const isLoading = roleEnCours || permissionsEnCours;

  return useMemo(
    () => ({
      peut: (permission: Permission) => peutCore(permissions, permission, estSuperadmin),
      peutUneDe: (liste: Permission[]) => peutUneDeCore(permissions, liste, estSuperadmin),
      permissions,
      role,
      estSuperadmin,
      isLoading,
      sansRole: !isLoading && role === null,
    }),
    [permissions, role, estSuperadmin, isLoading],
  );
}
