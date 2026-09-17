import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Profil, UtilisateurRow } from '@quinca/shared-types';
import { calculerEmpreinte, verifierEmpreinte } from '../../infrastructure/auth/empreinteLocale';
import { definirUtilisateurCourantId, lireUtilisateurCourantId } from '../../infrastructure/auth/utilisateurCourant';
import { deverrouiller, estVerrouille, verrouiller } from '../../infrastructure/auth/verrou';
import {
  clearLocalData,
  connectSync,
  countPendingUploads,
  db,
  definirProprietaireDonneesLocales,
  disconnectSync,
  proprietaireDonneesLocales,
} from '../../infrastructure/powersync/database';
import { estErreurReseau, lireSessionPersistee, supabase } from '../../infrastructure/supabase/client';
import { AuthContext } from './AuthContext';

interface Perimetre {
  profil: Profil;
  filiale_id: string | null;
}

const normaliser = (email: string) => email.trim().toLowerCase();

/** Le nouveau périmètre couvre-t-il l'ancien ? (même filiale, ou directeur qui voit tout) */
function perimetreCompatible(ancien: Perimetre | null, nouveau: Perimetre): boolean {
  if (!ancien) return false;
  if (nouveau.profil === 'DIRECTEUR') return true;
  return ancien.profil !== 'DIRECTEUR' && ancien.filiale_id === nouveau.filiale_id;
}

async function perimetreLocal(utilisateurId: string): Promise<Perimetre | null> {
  const row = await db.getOptional<UtilisateurRow>('SELECT profil, filiale_id FROM utilisateurs WHERE id = ?', [utilisateurId]);
  return row ? { profil: row.profil as Profil, filiale_id: row.filiale_id } : null;
}

/**
 * Enregistre l'empreinte du mot de passe sur la fiche de l'utilisateur (base
 * locale → serveur → tous les postes de la filiale). La fiche peut ne pas être
 * encore synchronisée sur un poste neuf : on attend la première synchronisation.
 */
async function publierEmpreinte(utilisateurId: string, empreinte: string): Promise<void> {
  await db.waitForFirstSync();
  await db.execute('UPDATE utilisateurs SET empreinte_hors_ligne = ? WHERE id = ?', [empreinte, utilisateurId]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [utilisateurId, setUtilisateurId] = useState<string | null>(lireUtilisateurCourantId);
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
  // en attente partent d'elles-mêmes au retour du réseau. Elle ne démarre pas tant que la base
  // locale appartient à une autre session (cas traité par `login`).
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
    const changementSession = Boolean(sessionLocale && normaliser(sessionLocale.user.email ?? '') !== normaliser(email));

    // Une autre session pourrait remplacer celle du poste : on suspend les envois le temps de décider.
    if (changementSession) await disconnectSync();

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (changementSession) connectSync().catch(() => undefined);
      if (!estErreurReseau(error)) {
        throw new Error(/invalid login credentials/i.test(error.message) ? 'Email ou mot de passe incorrect.' : error.message);
      }
      // Serveur injoignable : déverrouillage par l'empreinte synchronisée, pour tout utilisateur de la filiale.
      if (!sessionLocale) throw new Error('Serveur injoignable : la première connexion sur ce poste nécessite Internet.');
      const u = await db.getOptional<UtilisateurRow>('SELECT id, est_actif, empreinte_hors_ligne FROM utilisateurs WHERE lower(email) = ?', [normaliser(email)]);
      if (!u) throw new Error('Serveur injoignable : cet utilisateur est inconnu sur ce poste (autre filiale, ou jamais connecté en ligne).');
      if (u.est_actif === 0) throw new Error('Compte désactivé.');
      if (!(await verifierEmpreinte(u.empreinte_hors_ligne, password))) throw new Error('Mot de passe incorrect (vérification hors ligne).');
      definirUtilisateurCourantId(u.id);
      setUtilisateurId(u.id);
      deverrouiller();
      setVerrouille(false);
      setSession(sessionLocale);
      return;
    }

    // En ligne : la fiche fait foi (profil, filiale, actif).
    const { data: fiche, error: erreurFiche } = await supabase.from('utilisateurs').select('profil, filiale_id, est_actif').eq('id', data.user.id).single();
    const restaurerSessionPrecedente = async () => {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      if (sessionLocale) await supabase.auth.setSession({ access_token: sessionLocale.access_token, refresh_token: sessionLocale.refresh_token }).catch(() => undefined);
      connectSync().catch(() => undefined);
    };
    if (erreurFiche || !fiche) { await restaurerSessionPrecedente(); throw new Error('Profil utilisateur introuvable : contactez le directeur.'); }
    if (!fiche.est_actif) { await restaurerSessionPrecedente(); throw new Error('Compte désactivé.'); }

    const proprietaire = proprietaireDonneesLocales();
    if (proprietaire && proprietaire !== data.user.id) {
      const nouveau: Perimetre = { profil: fiche.profil as Profil, filiale_id: fiche.filiale_id };
      if (!perimetreCompatible(await perimetreLocal(proprietaire), nouveau)) {
        // Périmètre différent : la base locale sera remplacée, à condition que tout soit envoyé.
        const enAttente = await countPendingUploads();
        if (enAttente > 0) {
          await restaurerSessionPrecedente();
          throw new Error(`${enAttente} opération(s) de ${sessionLocale?.user.email ?? 'l’utilisateur précédent'} attendent d’être envoyées. Laissez le poste se synchroniser (réseau) avant de changer de filiale.`);
        }
        await clearLocalData();
      }
    }

    definirProprietaireDonneesLocales(data.user.id);
    definirUtilisateurCourantId(data.user.id);
    setUtilisateurId(data.user.id);
    deverrouiller();
    setVerrouille(false);
    await connectSync().catch(() => undefined);
    // L'empreinte part en arrière-plan (elle attend la fiche sur un poste neuf).
    calculerEmpreinte(password)
      .then((empreinte) => publierEmpreinte(data.user.id, empreinte))
      .catch((e) => console.error('[Auth] Empreinte hors ligne non publiée', e));
  }, []);

  const logout = useCallback(async () => {
    verrouiller();
    setVerrouille(true);
  }, []);

  const value = useMemo(() => ({ session, utilisateurId, verrouille, login, logout }), [session, utilisateurId, verrouille, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
