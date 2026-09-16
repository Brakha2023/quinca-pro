import { useMemo } from 'react';
import { usePowerSync } from '@powersync/react';
import type { CommonPowerSyncDatabase } from '@powersync/web';

type RepositoryCtor<R> = new (db: CommonPowerSyncDatabase) => R;

/** Instancie un repository lié à la base locale, une seule fois par composant. */
export function useRepository<R>(Repository: RepositoryCtor<R>): R {
  const db = usePowerSync();
  return useMemo(() => new Repository(db), [Repository, db]);
}
