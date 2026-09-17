import { useQuery } from '@powersync/react';
import type { Profil } from '@quinca/shared-types';
import { useAuth } from './useAuth';

export interface UtilisateurCourant {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  profil: Profil;
  filiale_id: string | null;
}

/**
 * Profil métier de l'utilisateur qui travaille sur le poste, lu dans la base
 * locale (la ligne `utilisateurs` est synchronisée par les sync rules).
 */
export function useCurrentUtilisateur() {
  const { utilisateurId: userId } = useAuth();

  const { data, isLoading } = useQuery<UtilisateurCourant>(
    'SELECT id, email, nom, prenom, profil, filiale_id FROM utilisateurs WHERE id = ?',
    [userId],
  );

  return { utilisateur: data[0] ?? null, isLoading };
}
