import {
  type CommonPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/web';
import { estEchecDefinitif } from '../../core/sync';
import { env } from '../config/env';
import { supabase } from '../supabase/client';
import { appliquerOperation, operationDepuisCrud } from './envoiSupabase';
import { EchecsEnvoiRepository } from './repositories/EchecsEnvoiRepository';

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

    const operations = transaction.crud.map(operationDepuisCrud);
    let rang = 0;

    try {
      for (; rang < operations.length; rang += 1) {
        await appliquerOperation(operations[rang]);
      }
      await transaction.complete();
    } catch (error) {
      if (!estEchecDefinitif(error)) {
        // Réseau, serveur indisponible, migration en retard : réparable côté
        // serveur. On relance, PowerSync réessaiera la même transaction.
        throw error;
      }

      /*
       * Refus définitif : réessayer ne corrigera jamais rien. On met de côté
       * l'opération fautive **et celles qui la suivent** — elles n'ont pas été
       * envoyées, et les lâcher serait perdre une écriture métier à moitié
       * passée. Puis on solde la transaction : la file repart.
       */
      await new EchecsEnvoiRepository(database).mettreDeCote(
        operations.slice(rang),
        error,
        transaction.transactionId,
      );
      console.error('[PowerSync] Écriture refusée par Supabase, mise de côté sur le poste', {
        table: operations[rang]?.table,
        id: operations[rang]?.id,
        operation: operations[rang]?.operation,
        misDeCote: operations.length - rang,
        error,
      });
      await transaction.complete();
    }
  }
}
