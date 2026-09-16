import { PowerSyncDatabase } from '@powersync/web';
import { AppSchema } from './schema';
import { SupabaseConnector } from './SupabaseConnector';

/**
 * Base SQLite locale, source de vérité de l'application (local-first).
 *
 * Toutes les lectures se font ici, en local, même hors ligne. Les écritures
 * sont appliquées localement puis mises en file pour être rejouées vers Supabase
 * par le {@link SupabaseConnector} dès qu'une connexion est disponible.
 */
export const db = new PowerSyncDatabase({
  database: {
    dbFilename: 'quinca-pro.db',
    // Une seule fenêtre Tauri : pas besoin du SharedWorker multi-onglets
    // (dont le support est inégal selon les WebViews).
    enableMultiTabs: false,
  },
  schema: AppSchema,
});

const connector = new SupabaseConnector();

/** Démarre la synchronisation avec le serveur (idempotent). */
export async function connectSync(): Promise<void> {
  if (db.connected || db.currentStatus.connecting) return;
  await db.connect(connector);
}

/** Coupe la synchronisation sans toucher aux données locales. */
export async function disconnectSync(): Promise<void> {
  await db.disconnect();
}

/** Nombre d'écritures locales en attente d'envoi au serveur. */
export async function countPendingUploads(): Promise<number> {
  const batch = await db.getCrudBatch(1000);
  return batch?.crud.length ?? 0;
}

/**
 * Coupe la synchronisation et efface les données locales.
 * À utiliser à la déconnexion d'un utilisateur : le poste peut être partagé.
 */
export async function clearLocalData(): Promise<void> {
  await db.disconnectAndClear();
}
