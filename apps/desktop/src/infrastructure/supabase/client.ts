import { createClient, type Session } from '@supabase/supabase-js';
import { env } from '../config/env';

/** Clé de stockage local de la session (contrôlée pour pouvoir la relire hors ligne). */
export const CLE_SESSION = 'quinca.auth';

/**
 * Client Supabase unique de l'application.
 * Sert à l'authentification et à l'upload des écritures PowerSync ;
 * les lectures passent toujours par la base SQLite locale.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storageKey: CLE_SESSION,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

/**
 * Session telle que persistée sur le poste, même si son jeton d'accès est expiré.
 *
 * Hors ligne, supabase-js conserve la session sur disque quand le
 * rafraîchissement échoue pour cause réseau, mais `getSession()` renvoie
 * `null` dès que le jeton d'accès est expiré. L'application local-first doit
 * pourtant rester utilisable : on considère l'utilisateur connecté tant qu'un
 * jeton de rafraîchissement existe ; il sera renouvelé au retour du réseau.
 */
export function lireSessionPersistee(): Session | null {
  try {
    const brut = localStorage.getItem(CLE_SESSION);
    if (!brut) return null;
    const session = JSON.parse(brut) as Partial<Session>;
    return session.refresh_token && session.user ? (session as Session) : null;
  } catch {
    return null;
  }
}

/** Erreur réseau (serveur injoignable), par opposition à un refus d'authentification. */
export function estErreurReseau(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /fetch|network|réseau|Load failed|ECONN|timeout/i.test(message);
}
