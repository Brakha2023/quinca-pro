import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { memoriserEmpreinte, verifierEmpreinte } from '../../infrastructure/auth/empreinteLocale';
import { deverrouiller, estVerrouille, verrouiller } from '../../infrastructure/auth/verrou';
import {
  clearLocalData,
  connectSync,
  countPendingUploads,
  definirProprietaireDonneesLocales,
  proprietaireDonneesLocales,
} from '../../infrastructure/powersync/database';
import { estErreurReseau, lireSessionPersistee, supabase } from '../../infrastructure/supabase/client';
import { AuthContext } from './AuthContext';

const memeEmail = (a: string | undefined, b: string) => (a ?? '').trim().toLowerCase() === b.trim().toLowerCase();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [verrouille, setVerrouille] = useState(estVerrouille);

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

  // Dès qu'une session existe — verrouillée ou non — la synchronisation tourne : les écritures
  // en attente partent d'elles-mêmes au retour du réseau. Elle ne démarre pas si la base locale
  // appartient à un autre utilisateur (cas traité par `login`, qui la vide d'abord).
  useEffect(() => {
    if (!session) return;
    const proprietaire = proprietaireDonneesLocales();
    if (proprietaire && proprietaire !== session.user.id) return;
    definirProprietaireDonneesLocales(session.user.id);
    connectSync().catch((error) => {
      console.error('[PowerSync] Échec de la connexion initiale, réessai automatique', error);
    });
  }, [session]);

  const login = useCallback(async (email: string, password: string) => {
    const sessionLocale = lireSessionPersistee();
    const changementUtilisateur = Boolean(sessionLocale && !memeEmail(sessionLocale.user.email, email));

    if (changementUtilisateur) {
      // Un autre utilisateur prend le poste : la base locale sera vidée, à condition que tout soit
      // envoyé — vérifié AVANT d'ouvrir une session, pour que la file ne parte jamais sous un autre nom.
      const enAttente = await countPendingUploads();
      if (enAttente > 0) {
        throw new Error(`${enAttente} opération(s) de ${sessionLocale?.user.email ?? 'l’utilisateur précédent'} attendent d’être envoyées. Laissez le poste se synchroniser (réseau) avant de changer d’utilisateur.`);
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (!estErreurReseau(error)) throw error;
      // Serveur injoignable : déverrouillage hors ligne du même utilisateur uniquement.
      if (sessionLocale && !changementUtilisateur && (await verifierEmpreinte(email, password))) {
        deverrouiller();
        setVerrouille(false);
        setSession(sessionLocale);
        return;
      }
      throw new Error(
        sessionLocale
          ? 'Serveur injoignable : seul l’utilisateur de la session en cours peut déverrouiller ce poste hors ligne.'
          : 'Serveur injoignable : la première connexion sur ce poste nécessite Internet.',
      );
    }

    const proprietaire = proprietaireDonneesLocales();
    if (proprietaire && proprietaire !== data.user.id) {
      await clearLocalData();
    }
    definirProprietaireDonneesLocales(data.user.id);
    await memoriserEmpreinte(email, password);
    deverrouiller();
    setVerrouille(false);
    await connectSync().catch(() => undefined);
  }, []);

  const logout = useCallback(async () => {
    verrouiller();
    setVerrouille(true);
  }, []);

  const value = useMemo(() => ({ session, verrouille, login, logout }), [session, verrouille, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
