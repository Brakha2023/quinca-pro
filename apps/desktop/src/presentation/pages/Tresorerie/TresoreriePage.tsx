import { Navigate, NavLink, useParams } from 'react-router-dom';
import { CATEGORIES_DEPENSE, CATEGORIES_RECETTE } from '../../../core/tresorerie';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import CaissesPanel from '../../features/tresorerie/CaissesPanel';
import OperationPanel, { type ConfigOperation } from '../../features/tresorerie/OperationPanel';
import RetraitPanel from '../../features/tresorerie/RetraitPanel';
import TransfertCaissePanel from '../../features/tresorerie/TransfertCaissePanel';
import TransfertFilialePanel from '../../features/tresorerie/TransfertFilialePanel';
import VersementPanel from '../../features/tresorerie/VersementPanel';
import { SECTIONS_TRESORERIE, SECTION_TRESORERIE_DEFAUT, cheminTresorerie, estSectionTresorerie } from './onglets';

const ENTREE_EN_CAISSE: ConfigOperation = {
  type: 'RECETTE',
  categories: CATEGORIES_RECETTE,
  titreRecu: 'Reçu d’entrée en caisse',
  libelleTiers: 'Déposant',
  signatureTiers: 'Signature du déposant',
  libelleBouton: 'Enregistrer l’entrée',
  titreHistorique: 'Dernières entrées en caisse',
  prefixeTest: 'entree',
};

const DEPENSE: ConfigOperation = {
  type: 'DEPENSE',
  categories: CATEGORIES_DEPENSE,
  titreRecu: 'Pièce de dépense',
  libelleTiers: 'Bénéficiaire',
  signatureTiers: 'Signature du bénéficiaire',
  libelleBouton: 'Enregistrer la dépense',
  titreHistorique: 'Dernières dépenses',
  prefixeTest: 'depense',
};

/** Module Trésorerie : caisses, versements, retraits, entrées, transferts et dépenses. */
export default function TresoreriePage() {
  const { filialeId, filiale, filiales, estVueConsolidee } = useFilialeCourante();
  const { section } = useParams();

  if (!estSectionTresorerie(section)) return <Navigate to={cheminTresorerie(SECTION_TRESORERIE_DEFAUT)} replace />;

  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Trésorerie</h1>
        <p className="text-sm text-neutral-500 mt-1">{filiale ? `${filiale.nom} · ` : ''}Caisses, encaissements et sorties d'espèces, enregistrés localement et synchronisés automatiquement.</p>
      </div>

      {!filialeId ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
          {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50 print:hidden">
            {SECTIONS_TRESORERIE.map((s) => (
              <NavLink key={s.id} to={cheminTresorerie(s.id)} className={({ isActive }) => `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${isActive ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'}`}>
                <s.icon className="w-4 h-4" />{s.label}
              </NavLink>
            ))}
          </div>
          <div className="p-6 bg-neutral-50/50">
            {section === 'caisses' && <CaissesPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'versement' && <VersementPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'retrait' && <RetraitPanel filialeId={filialeId} filiale={infosFiliale} />}
            {section === 'entree' && <OperationPanel filialeId={filialeId} filiale={infosFiliale} config={ENTREE_EN_CAISSE} />}
            {section === 'transfert-caisse' && <TransfertCaissePanel filialeId={filialeId} />}
            {section === 'transfert-filiale' && <TransfertFilialePanel filialeId={filialeId} filiale={infosFiliale} filiales={filiales.map((f) => ({ id: f.id, nom: f.nom }))} />}
            {section === 'depense' && <OperationPanel filialeId={filialeId} filiale={infosFiliale} config={DEPENSE} />}
          </div>
        </div>
      )}
    </div>
  );
}
