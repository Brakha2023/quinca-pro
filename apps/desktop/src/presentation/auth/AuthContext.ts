import { createContext } from 'react';
import type { Session } from '@supabase/supabase-js';

export interface AuthContextValue {
  /**
   * Session Supabase du poste (dernier utilisateur connecté en ligne) : elle
   * signe la synchronisation. `undefined` tant qu'elle n'a pas été lue.
   */
  session: Session | null | undefined;
  /** Utilisateur qui travaille sur le poste (peut différer de la session hors ligne). */
  utilisateurId: string | null;
  /** Poste verrouillé : la session existe mais l'interface exige le mot de passe. */
  verrouille: boolean;
  /**
   * Connexion ou déverrouillage. En ligne, le mot de passe est vérifié par
   * Supabase ; hors ligne, par l'empreinte synchronisée dans `utilisateurs`
   * (tout utilisateur de la filiale du poste).
   */
  login: (email: string, password: string) => Promise<void>;
  /**
   * Verrouille le poste : la session et la base locale sont conservées, la
   * synchronisation continue en arrière-plan. Rien n'est jamais perdu.
   */
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
