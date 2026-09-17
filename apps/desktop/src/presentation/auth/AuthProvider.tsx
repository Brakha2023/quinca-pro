import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { estErreurReseau, lireSessionPersistee, supabase } from '../../infrastructure/supabase/client';
import { clearLocalData, connectSync, countPendingUploads } from '../../infrastructure/powersync/database';
import { AuthContext } from './AuthContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    // Hors ligne avec un jeton expiré, getSession() renvoie null alors que la session
    // est toujours sur disque : on la reprend pour laisser travailler en local.
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? lireSessionPersistee()));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'SIGNED_OUT') { setSession(null); return; }
      setSession(nextSession ?? lireSessionPersistee());
    });

    return () => subscription.unsubscribe();
  }, []);

  // Dès qu'une session existe, la synchronisation démarre (et reprend après un redémarrage hors ligne :
  // la session Supabase est persistée localement, la base SQLite aussi).
  useEffect(() => {
    if (!session) return;
    connectSync().catch((error) => {
      console.error('[PowerSync] Échec de la connexion initiale, réessai automatique', error);
    });
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if (estErreurReseau(error)) throw new Error('Serveur injoignable : la première connexion sur ce poste nécessite Internet.');
      throw error;
    }
  }, []);

  const logout = useCallback(async (options?: { force?: boolean }) => {
    const pendingUploads = await countPendingUploads();
    if (pendingUploads > 0 && !options?.force) {
      return { pendingUploads };
    }
    await clearLocalData();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo(() => ({ session, login, logout }), [session, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
