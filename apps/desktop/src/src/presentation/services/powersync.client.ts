import { PowerSyncDatabase, WebRemote } from '@powersync/web';
import { schema } from './powersync.schema';

const POWER_SYNC_URL = import.meta.env.VITE_POWERSYNC_URL;

if (!POWER_SYNC_URL) {
  console.warn('⚠️ Variable VITE_POWERSYNC_URL manquante');
}

let db: PowerSyncDatabase | null = null;

export function getPowerSyncDatabase(): PowerSyncDatabase {
  if (!db) {
    // Utiliser un nouveau nom de base pour éviter la corruption
    db = new PowerSyncDatabase({
      database: { 
        dbFilename: 'quinca-pro-v2.db'  // Changé pour éviter le fichier corrompu
      },
      schema: schema,
      flags: {
        enableMultiTabs: false,
      },
    });
  }

  return db;
}

export async function connectWithSupabase(): Promise<PowerSyncDatabase> {
  const database = getPowerSyncDatabase();
  
  if (!POWER_SYNC_URL) {
    console.error('❌ URL PowerSync non configurée');
    return database;
  }

  const remote = new WebRemote({
    endpoint: POWER_SYNC_URL,
    headers: {},
  });

  try {
    await database.connect(remote);
    console.log('✅ PowerSync connecté');
  } catch (error) {
    console.error('❌ Erreur:', error);
  }

  return database;
}

export const connectPowerSync = connectWithSupabase;

export async function disconnect(): Promise<void> {
  if (db) {
    await db.disconnect();
    db = null;
  }
}

export function getConnectionStatus() {
  if (!db) {
    return { connected: false, connecting: false, lastSyncedAt: null };
  }
  return {
    connected: db.connected,
    connecting: db.connecting,
    lastSyncedAt: db.lastSyncedAt,
  };
}

export function usePowerSync(): PowerSyncDatabase {
  return getPowerSyncDatabase();
}