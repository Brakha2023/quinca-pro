import { useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LockClosedIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../auth/useAuth';
import { useFileEnvoi } from '../../auth/useFileEnvoi';

export default function LoginPage() {
  const { session, verrouille, login } = useAuth();
  const location = useLocation();
  const [emailSaisi, setEmailSaisi] = useState<string | null>(null);
  // Poste verrouillé : l'email de la session est proposé tant que l'utilisateur n'en saisit pas un autre.
  const email = emailSaisi ?? ((verrouille && session?.user.email) || '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { enAttente, connecte } = useFileEnvoi();

  // Déjà connecté (ou session restaurée au démarrage) : on ne montre pas le formulaire.
  if (session && !verrouille) {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/';
    return <Navigate to={from} replace />;
  }

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // La synchronisation PowerSync démarre automatiquement dès que la session existe (AuthProvider).
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 to-primary-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">QCF</span>
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">QuincaPro</h1>
          <p className="text-sm text-neutral-500 mt-1">Gestion Commerciale Multi-Filiales</p>
        </div>

        {verrouille && session && (
          <div className="mb-6 rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <p className="flex items-center gap-2 font-medium"><LockClosedIcon className="w-4 h-4" /> Poste verrouillé — session de {session.user.email}</p>
            <p className="mt-1 text-xs text-neutral-500">
              {enAttente > 0
                ? `${enAttente} opération(s) en attente d’envoi${connecte ? ' — envoi en cours' : ' — partiront dès que le réseau sera disponible'}.`
                : 'Toutes les opérations sont envoyées au serveur.'}
              {' '}Un autre utilisateur ne peut prendre le poste qu’une fois la file vide.
            </p>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmailSaisi(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="directeur@qcf.ci"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-semibold rounded-lg transition-colors"
          >
            {loading ? 'Connexion...' : verrouille ? 'Déverrouiller' : 'Se connecter'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-neutral-200">
          <p className="text-xs text-neutral-500 text-center">
            Version 1.0 · Architecture PowerSync · Local-First
          </p>
        </div>
      </div>
    </div>
  );
}