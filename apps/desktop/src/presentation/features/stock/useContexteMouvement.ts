import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import type { ContexteMouvement } from '../../../infrastructure/powersync/repositories/StockRepository';

/** Filiale et utilisateur à horodater sur chaque mouvement de stock. */
export function useContexteMouvement(filialeId: string): ContexteMouvement {
  const { utilisateur } = useCurrentUtilisateur();
  return { filialeId, utilisateurId: utilisateur?.id ?? null };
}
