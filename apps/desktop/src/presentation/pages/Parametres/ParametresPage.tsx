import { Navigate, NavLink, useParams } from 'react-router-dom';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { usePermissions } from '../../auth/usePermissions';
import RolesPanel from '../../features/parametres/RolesPanel';
import UtilisateursPanel from '../../features/parametres/UtilisateursPanel';
import { SECTIONS_PARAMETRES, SECTION_PARAMETRES_DEFAUT, cheminParametres, estSectionParametres } from './onglets';

/**
 * Paramètres : qui a le droit de quoi.
 *
 * Deux sections, et le partage est net — les **rôles** disent ce qu'on peut
 * faire, les **utilisateurs** disent qui porte quel rôle. L'écran ne crée pas
 * de compte de connexion : c'est Supabase qui les porte (voir le panneau
 * Utilisateurs), et c'est voulu — un mot de passe ne se fabrique pas depuis un
 * poste de caisse.
 */
export default function ParametresPage() {
  const { section } = useParams();
  const { utilisateur, filiale, filiales } = useFilialeCourante();
  const { peut, isLoading } = usePermissions();

  if (!estSectionParametres(section)) return <Navigate to={cheminParametres(SECTION_PARAMETRES_DEFAUT)} replace />;

  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
        Lecture de votre rôle…
      </div>
    );
  }

  // Le menu ne mène pas ici sans la permission, mais l'URL se tape à la main.
  if (!peut('parametres.lire')) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16">
        <p className="text-lg text-neutral-700">Les paramètres ne vous sont pas ouverts.</p>
        <p className="text-sm text-neutral-500 mt-2">Demandez la permission « Ouvrir les paramètres » au superadministrateur.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Paramètres</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Les rôles décident de ce que chacun peut faire ; l'affectation décide de qui porte quel rôle.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50 print:hidden">
          {SECTIONS_PARAMETRES.map((s) => (
            <NavLink
              key={s.id}
              to={cheminParametres(s.id)}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`
              }
            >
              <s.icon className="w-4 h-4" />
              {s.label}
            </NavLink>
          ))}
        </div>

        <div className="p-6">
          {section === 'roles' ? (
            <RolesPanel filiale={infosFiliale} peutModifier={peut('parametres.roles')} />
          ) : (
            <UtilisateursPanel
              filiale={infosFiliale}
              filiales={filiales.map((f) => ({ id: f.id, nom: f.nom ?? '' }))}
              utilisateurCourantId={utilisateur?.id ?? null}
              peutModifier={peut('parametres.utilisateurs')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
