import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface AuthContextValue {
  /** `undefined` tant que la session initiale n'a pas été lue. */
  session: Session | null | undefined;
  login: (email: string, password: string) => Promise<void>;
  /**
   * Déconnecte l'utilisateur et efface les données locales.
   * Refuse si des écritures ne sont pas encore remontées au serveur,
   * sauf si `force` est vrai.
   */
  logout: (options?: { force?: boolean }) => Promise<{ pendingUploads: number } | void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
