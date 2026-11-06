import { Navigate, NavLink, useNavigate, useParams } from 'react-router-dom';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import ClientFormModal from '../../features/clients/ClientFormModal';
import CompteClientPanel from '../../features/clients/CompteClientPanel';
import ProformasPanel from '../../features/clients/ProformasPanel';
import RelanceClientsPanel from '../../features/clients/RelanceClientsPanel';
import RepertoirePanel from '../../features/clients/RepertoirePanel';
import VersementsPanel from '../../features/clients/VersementsPanel';
import { SECTIONS_CLIENTS, SECTION_CLIENTS_DEFAUT, cheminClients, estSectionClients } from './onglets';

/** Module Clients : répertoire, fiche, proformas, compte, versements, relances. */
export default function ClientsPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { section } = useParams();
  const navigate = useNavigate();

  if (!estSectionClients(section)) return <Navigate to={cheminClients(SECTION_CLIENTS_DEFAUT)} replace />;

  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Clients</h1>
        <p className="text-sm text-neutral-500 mt-1">{filiale ? `${filiale.nom} · ` : ''}Comptes, proformas et versements enregistrés localement, synchronisés automatiquement.</p>
      </div>

      {!filialeId ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
          {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50">
            {SECTIONS_CLIENTS.map((s) => (
              <NavLink key={s.id} to={cheminClients(s.id)} className={({ isActive }) => `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive ? 'border-accent-500 text-accent-600 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                <s.icon className="w-4 h-4" />{s.label}
              </NavLink>
            ))}
          </div>
          <div className="p-6 bg-neutral-50/50">
            {(section === 'repertoire' || section === 'nouveau') && <RepertoirePanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'nouveau' && <ClientFormModal filialeId={filialeId} onClose={() => navigate(cheminClients('repertoire'))} onCreated={(id) => navigate(cheminClients('compte', id))} />}
            {section === 'proformas' && <ProformasPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'compte' && <CompteClientPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'versements' && <VersementsPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'relance' && <RelanceClientsPanel filialeId={filialeId} filiale={infosFiliale} />}
          </div>
        </div>
      )}
    </div>
  );
}
