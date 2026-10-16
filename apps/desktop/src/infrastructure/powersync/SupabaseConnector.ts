import {
  type CommonPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
  UpdateType,
} from '@powersync/web';
import { env } from '../config/env';
import { supabase } from '../supabase/client';
import { sansCumulsServeur } from './cumulsServeur';

/**
 * Codes d'erreur Postgres pour lesquels réessayer est inutile :
 * la ligne est rejetée définitivement (contrainte, type, droits).
 * Dans ce cas on abandonne la transaction locale pour ne pas bloquer
 * la file d'upload indéfiniment.
 *
 * - 22xxx : data exception (type, format)
 * - 23xxx : integrity constraint violation (unique, FK, check)
 * - 42501 : insufficient privilege (RLS)
 */
const FATAL_RESPONSE_CODES = [/^22\d{3}$/, /^23\d{3}$/, /^42501$/];

function isFatalError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code;
  return typeof code === 'string' && FATAL_RESPONSE_CODES.some((re) => re.test(code));
}

/**
 * Pont entre PowerSync et Supabase.
 *
 * - `fetchCredentials` : fournit le JWT Supabase de la session courante au service PowerSync.
 * - `uploadData` : rejoue la file CRUD locale (INSERT/UPDATE/DELETE faits hors ligne) vers Postgres,
 *   une transaction à la fois, dans l'ordre.
 */
export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session) return null;

    return {
      endpoint: env.powerSyncUrl,
      token: session.access_token,
      expiresAt: session.expires_at ? new Date(session.expires_at * 1000) : undefined,
    };
  }

  async uploadData(database: CommonPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    let lastOp: CrudEntry | null = null;

    try {
      for (const op of transaction.crud) {
        lastOp = op;
        await this.applyOperation(op);
      }
      await transaction.complete();
    } catch (error) {
      if (!isFatalError(error)) {
        // Erreur réseau ou temporaire : on relance, PowerSync réessaiera.
        throw error;
      }

      // Erreur définitive : la donnée locale est incohérente avec le serveur.
      // On l'abandonne pour débloquer la file, en le tracant clairement.
      console.error('[PowerSync] Opération rejetée définitivement par Supabase, transaction abandonnée', {
        table: lastOp?.table,
        id: lastOp?.id,
        op: lastOp?.op,
        error,
      });
      await transaction.complete();
    }
  }

  private async applyOperation(op: CrudEntry): Promise<void> {
    const table = supabase.from(op.table);

    switch (op.op) {
      case UpdateType.PUT: {
        const donnees = sansCumulsServeur(op.table, op.opData);
        // La ligne doit exister côté serveur pour garder l'identifiant du poste,
        // même si elle ne porte plus que sa clé : le déclencheur fera le reste.
        const { error } = await table.upsert({ ...(donnees ?? {}), id: op.id });
        if (error) throw error;
        return;
      }
      case UpdateType.PATCH: {
        const donnees = sansCumulsServeur(op.table, op.opData);
        if (!donnees) return; // n'envoyait qu'un cumul : le journal suffit au serveur
        const { error } = await table.update(donnees).eq('id', op.id);
        if (error) throw error;
        return;
      }
      case UpdateType.DELETE: {
        const { error } = await table.delete().eq('id', op.id);
        if (error) throw error;
        return;
      }
    }
  }
}
