import { useCallback, useEffect, useState } from 'react';
import {
  EchecsEnvoiRepository,
  surChangementEchecs,
  type EchecEnvoiVue,
} from '../../../infrastructure/powersync/repositories/EchecsEnvoiRepository';
import { useRepository } from '../../hooks/useRepository';

/**
 * Écritures mises de côté, relues à chaque changement.
 *
 * Lecture explicite plutôt que `useQuery` : PowerSync ne notifie pas les
 * changements d'une table locale (voir `EchecsEnvoiRepository`).
 */
export function useEchecsEnvoi() {
  const repository = useRepository(EchecsEnvoiRepository);
  const [echecs, setEchecs] = useState<EchecEnvoiVue[]>([]);

  const recharger = useCallback(() => {
    repository.lister().then(setEchecs).catch(() => setEchecs([]));
  }, [repository]);

  useEffect(() => {
    recharger();
    return surChangementEchecs(recharger);
  }, [recharger]);

  return { echecs, recharger };
}
