import { PowerSyncDatabase } from '@powersync/web';
import { debutHistoriqueLocal } from '../../core/sync';
import { COMPTER_ECHECS_ENVOI_QUERY } from './repositories/EchecsEnvoiRepository';
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

/**
 * Démarre la synchronisation avec le serveur (idempotent).
 *
 * `depuis` borne l'activité téléchargée (voir `core/sync/historique` et
 * `supabase/sync-streams.yaml`). C'est un paramètre de connexion : le changer
 * demande de se reconnecter, d'où le calcul ici, une fois, à l'ouverture.
 */
export async function connectSync(): Promise<void> {
  if (db.connected || db.currentStatus.connecting) return;
  await db.connect(connector, { params: { depuis: debutHistoriqueLocal() } });
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
 * Nombre d'écritures que le serveur a refusées définitivement et qui attendent
 * une décision. Elles ne sont plus dans la file d'envoi : effacer la base
 * locale les perdrait sans que personne ne l'ait décidé.
 */
export async function countEcrituresMisesDeCote(): Promise<number> {
  const row = await db.getOptional<{ n: number }>(COMPTER_ECHECS_ENVOI_QUERY);
  return row?.n ?? 0;
}

/**
 * Coupe la synchronisation et efface les données locales.
 * Uniquement quand un autre utilisateur prend le poste, et seulement si la
 * file d'envoi est vide (sinon ses écritures seraient perdues).
 */
export async function clearLocalData(): Promise<void> {
  await db.disconnectAndClear();
  localStorage.removeItem(CLE_PROPRIETAIRE);
}

const CLE_PROPRIETAIRE = 'quinca.donnees.utilisateur';

/**
 * Identifiant de l'utilisateur dont la session Supabase signe la synchronisation
 * du poste (et dont le périmètre — sa filiale, ou tout pour un directeur —
 * définit le contenu de la base locale).
 */
export function proprietaireDonneesLocales(): string | null {
  try {
    return localStorage.getItem(CLE_PROPRIETAIRE);
  } catch {
    return null;
  }
}

export function definirProprietaireDonneesLocales(utilisateurId: string): void {
  localStorage.setItem(CLE_PROPRIETAIRE, utilisateurId);
}
