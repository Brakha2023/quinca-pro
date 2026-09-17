import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

/** Protège un sous-arbre de routes : redirige vers /login sans session ou si le poste est verrouillé. */
export default function RequireAuth() {
  const { session, utilisateurId, verrouille } = useAuth();
  const location = useLocation();

  if (session === undefined) {
    return (
      <div className="h-screen flex items-center justify-center text-neutral-500 text-sm">
        Chargement de la session…
      </div>
    );
  }

  if (!session || !utilisateurId || verrouille) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
