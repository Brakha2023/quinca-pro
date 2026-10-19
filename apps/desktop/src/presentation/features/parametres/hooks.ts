import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { RoleRow, UtilisateurRow } from '@quinca/shared-types';
import { roleFromRow, utilisateurAdministreFromRow, type Role, type UtilisateurAdministre } from '../../../core/parametres';
import {
  PERMISSIONS_ROLES_QUERY, ROLES_QUERY, UTILISATEURS_QUERY,
} from '../../../infrastructure/powersync/repositories/RolesRepository';

export interface RoleAvecPorteurs extends Role {
  porteurs: number;
}

export function useRoles() {
  const { data, isLoading } = useQuery<RoleRow & { porteurs: number }>(ROLES_QUERY);
  const roles = useMemo<RoleAvecPorteurs[]>(
    () => data.map((row) => ({ ...roleFromRow(row), porteurs: row.porteurs ?? 0 })),
    [data],
  );
  return { roles, isLoading };
}

/**
 * Permissions de tous les rôles, en une lecture : `role_id → permissions`.
 * L'écran coche des cases rôle par rôle, mais le tableau d'ensemble et son
 * impression ont besoin de tout d'un coup.
 */
export function usePermissionsDesRoles() {
  const { data, isLoading } = useQuery<{ role_id: string | null; permission: string | null }>(PERMISSIONS_ROLES_QUERY);
  const parRole = useMemo(() => {
    const index = new Map<string, Set<string>>();
    for (const ligne of data) {
      if (!ligne.role_id || !ligne.permission) continue;
      const jeu = index.get(ligne.role_id) ?? new Set<string>();
      jeu.add(ligne.permission);
      index.set(ligne.role_id, jeu);
    }
    return index;
  }, [data]);
  return { parRole, isLoading };
}

type LigneUtilisateur = UtilisateurRow & {
  role_nom: string | null;
  role_est_superadmin: number | null;
  filiale_nom: string | null;
};

export function useUtilisateursAdministres() {
  const { data, isLoading } = useQuery<LigneUtilisateur>(UTILISATEURS_QUERY);
  const utilisateurs = useMemo<UtilisateurAdministre[]>(() => data.map(utilisateurAdministreFromRow), [data]);
  return { utilisateurs, isLoading };
}
