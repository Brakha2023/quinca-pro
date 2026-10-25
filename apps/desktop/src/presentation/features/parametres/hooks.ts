import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { ParametresFilialeRow, RoleRow, UtilisateurRow } from '@quinca/shared-types';
import {
  entrepriseFromRow, roleFromRow, utilisateurAdministreFromRow,
  type Entreprise, type Role, type UtilisateurAdministre,
} from '../../../core/parametres';
import {
  ENTREPRISES_QUERY, ENTREPRISE_DOCUMENT_QUERY, ENTREPRISE_QUERY,
} from '../../../infrastructure/powersync/repositories/EntrepriseRepository';
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

/**
 * Fiche de la filiale regardée.
 *
 * `absente` distingue « pas encore lue » de « cette filiale n'en a pas » : la
 * seconde se soigne côté serveur (la migration en pose une par filiale), et
 * l'écran doit le dire plutôt que d'ouvrir un formulaire qui n'enregistrera
 * rien.
 */
export function useEntreprise(filialeId: string | null) {
  const { data, isLoading } = useQuery<ParametresFilialeRow>(ENTREPRISE_QUERY, [filialeId ?? '']);
  const entreprise = useMemo<Entreprise | null>(() => (data[0] ? entrepriseFromRow(data[0]) : null), [data]);
  return { entreprise, isLoading, absente: !isLoading && !entreprise && Boolean(filialeId) };
}

export interface EntrepriseListee extends Entreprise {
  filiale_nom: string;
  filiale_code: string;
}

/** Toutes les fiches reçues : le sélecteur de l'écran passe de l'une à l'autre. */
export function useEntreprises() {
  const { data, isLoading } = useQuery<ParametresFilialeRow & { filiale_nom: string | null; filiale_code: string | null }>(
    ENTREPRISES_QUERY,
  );
  const entreprises = useMemo<EntrepriseListee[]>(
    () => data.map((row) => ({
      ...entrepriseFromRow(row),
      filiale_nom: row.filiale_nom ?? '',
      filiale_code: row.filiale_code ?? '',
    })),
    [data],
  );
  return { entreprises, isLoading };
}

/**
 * Fiche dont un document tire son en-tête — voir `ENTREPRISE_DOCUMENT_QUERY`.
 * Distincte de `useEntreprise` : celle-ci ne rend jamais rien quand le poste a
 * au moins une filiale, pour qu'une pièce ne sorte jamais sans papier à en-tête.
 */
export function useEntrepriseDocument(filialeId: string | null) {
  const cle = filialeId ?? '';
  const { data } = useQuery<ParametresFilialeRow>(ENTREPRISE_DOCUMENT_QUERY, [cle, cle, cle]);
  return useMemo<Entreprise | null>(() => (data[0] ? entrepriseFromRow(data[0]) : null), [data]);
}
