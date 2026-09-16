import { useQuery } from '@powersync/react';
import { useAuth } from './useAuth';

export interface UtilisateurCourant {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  profil: 'DIRECTEUR' | 'GERANT' | 'CAISSIER' | 'MAGASINIER';
  filiale_id: string | null;
}

/**
 * Profil métier de l'utilisateur connecté, lu dans la base locale
 * (la ligne `utilisateurs` est synchronisée par les sync rules).
 */
export function useCurrentUtilisateur() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const { data, isLoading } = useQuery<UtilisateurCourant>(
    'SELECT id, email, nom, prenom, profil, filiale_id FROM utilisateurs WHERE id = ?',
    [userId],
  );

  return { utilisateur: data[0] ?? null, isLoading };
}
