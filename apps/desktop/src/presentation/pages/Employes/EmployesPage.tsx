import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import EffectifPanel from '../../features/employes/EffectifPanel';
import EmployeFormModal from '../../features/employes/EmployeFormModal';
import PaiePanel from '../../features/employes/PaiePanel';
import PaiementPanel from '../../features/employes/PaiementPanel';
import PointagePanel from '../../features/employes/PointagePanel';
import { SECTIONS_EMPLOYES, SECTION_EMPLOYES_DEFAUT, cheminEmployes, estSectionEmployes } from './onglets';

/** Module Employés : effectif, fiches, pointage, paie et paiement des salaires. */
export default function EmployesPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { section } = useParams();
  const navigate = useNavigate();

  if (!estSectionEmployes(section)) return <Navigate to={cheminEmployes(SECTION_EMPLOYES_DEFAUT)} replace />;

  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Employés</h1>
        <p className="text-sm text-neutral-500 mt-1">{filiale ? `${filiale.nom} · ` : ''}Fiches, pointages et paies enregistrés localement, synchronisés automatiquement.</p>
      </div>

      {!filialeId ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
          {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50">
            {SECTIONS_EMPLOYES.map((s) => (
              <NavLink key={s.id} to={cheminEmployes(s.id)} className={({ isActive }) => `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive ? 'border-accent-500 text-accent-600 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                <s.icon className="w-4 h-4" />{s.label}
              </NavLink>
            ))}
          </div>
          <div className="p-6 bg-neutral-50/50">
            {(section === 'effectif' || section === 'nouveau') && <EffectifPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'nouveau' && <EmployeFormModal filialeId={filialeId} onClose={() => navigate(cheminEmployes('effectif'))} onEnregistre={() => navigate(cheminEmployes('effectif'))} />}
            {section === 'pointage' && <PointagePanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'paie' && <PaiePanel filialeId={filialeId} />}
            {section === 'paiement' && <PaiementPanel filialeId={filialeId} filiale={infosFiliale} />}
          </div>
        </div>
      )}
    </div>
  );
}
