import type { CommonPowerSyncDatabase, LockContext } from '@powersync/web';
import { v4 as uuidv4 } from 'uuid';

/**
 * Socle des repositories : accès à la base locale, identifiants et horodatage
 * générés côté client (indispensable hors ligne).
 */
export abstract class BaseRepository {
  constructor(protected readonly db: CommonPowerSyncDatabase) {}

  protected nouvelId(): string {
    return uuidv4();
  }

  protected maintenant(): string {
    return new Date().toISOString();
  }

  /** Exécute une mise à jour partielle : `SET col = ?, …, updated_at = ? WHERE id = ?`. */
  protected async patch(
    executor: Pick<LockContext, 'execute'>,
    table: string,
    id: string,
    valeurs: Record<string, string | number | null>,
  ): Promise<void> {
    const entrees = Object.entries({ ...valeurs, updated_at: this.maintenant() });
    const set = entrees.map(([col]) => `${col} = ?`).join(', ');
    await executor.execute(`UPDATE ${table} SET ${set} WHERE id = ?`, [...entrees.map(([, v]) => v), id]);
  }
}
