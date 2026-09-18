import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import CommandesPanel from '../../features/fournisseurs/CommandesPanel';
import CompteFournisseurPanel from '../../features/fournisseurs/CompteFournisseurPanel';
import FournisseurFormModal from '../../features/fournisseurs/FournisseurFormModal';
import ReglementsPanel from '../../features/fournisseurs/ReglementsPanel';
import RelancePanel from '../../features/fournisseurs/RelancePanel';
import RepertoirePanel from '../../features/fournisseurs/RepertoirePanel';
import { SECTIONS_FOURNISSEURS, SECTION_FOURNISSEURS_DEFAUT, cheminFournisseurs, estSectionFournisseurs } from './onglets';

/** Module Fournisseurs : répertoire, fiche, compte, règlements, bons de commande, relances. */
export default function FournisseursPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { section } = useParams();
  const navigate = useNavigate();

  if (!estSectionFournisseurs(section)) return <Navigate to={cheminFournisseurs(SECTION_FOURNISSEURS_DEFAUT)} replace />;

  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Fournisseurs</h1>
        <p className="text-sm text-neutral-500 mt-1">{filiale ? `${filiale.nom} · ` : ''}Comptes, commandes et règlements enregistrés localement, synchronisés automatiquement.</p>
      </div>

      {!filialeId ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
          {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50">
            {SECTIONS_FOURNISSEURS.map((s) => (
              <NavLink key={s.id} to={cheminFournisseurs(s.id)} className={({ isActive }) => `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                <s.icon className="w-4 h-4" />{s.label}
              </NavLink>
            ))}
          </div>
          <div className="p-6 bg-neutral-50/50">
            {(section === 'repertoire' || section === 'nouveau') && <RepertoirePanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'nouveau' && <FournisseurFormModal filialeId={filialeId} onClose={() => navigate(cheminFournisseurs('repertoire'))} onEnregistre={(id) => navigate(cheminFournisseurs('compte', id))} />}
            {section === 'compte' && <CompteFournisseurPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'reglements' && <ReglementsPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'commandes' && <CommandesPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'relance' && <RelancePanel filialeId={filialeId} filiale={infosFiliale} />}
          </div>
        </div>
      )}
    </div>
  );
}
