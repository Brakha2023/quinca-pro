import { useState } from 'react';
import { DocumentTextIcon, EyeIcon, MagnifyingGlassIcon, PencilSquareIcon, PrinterIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import Bouton from '../../components/ui/Bouton';
import { LIBELLES_SEXE, LIBELLES_TYPE_CONTRAT, nomComplet, type Employe } from '../../../core/employes';
import { EmployesRepository } from '../../../infrastructure/powersync/repositories/EmployesRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import Modal from '../../components/ui/Modal';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import EmployeFormModal from './EmployeFormModal';
import { useEmploye, useEmployes } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/** Fiche détaillée (photo, contrat joint consultable). */
function DetailEmploye({ filialeId, employeId, onClose }: { filialeId: string; employeId: string; onClose: () => void }) {
  const employe = useEmploye(employeId);
  const [modal, setModal] = useState<'modifier' | 'contrat' | null>(null);
  if (!employe) return null;
  const estPdf = employe.contrat_fichier?.startsWith('data:application/pdf');
  return (
    <>
      <Modal titre={nomComplet(employe)} sousTitre={`${employe.matricule} · ${employe.fonction ?? 'Fonction non renseignée'}`} largeur="max-w-2xl" onClose={onClose} pied={
        <>
          {employe.contrat_fichier && <Bouton onClick={() => setModal('contrat')} icone={DocumentTextIcon} className="mr-auto flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Voir le contrat</Bouton>}
          <button type="button" onClick={() => setModal('modifier')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"><PencilSquareIcon className="w-4 h-4" /> Modifier</button>
        </>
      }>
        <div className="flex gap-6">
          <div className="w-36 h-36 shrink-0 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center">
            {employe.photo ? <img src={employe.photo} alt="" className="w-full h-full object-cover" data-testid="photo-employe" /> : <UserCircleIcon className="w-16 h-16 text-neutral-300" />}
          </div>
          <dl className="flex-1 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <dt className="text-neutral-500">Sexe</dt><dd>{employe.sexe ? LIBELLES_SEXE[employe.sexe] : '—'}</dd>
            <dt className="text-neutral-500">Téléphone</dt><dd>{employe.telephone ?? '—'}</dd>
            <dt className="text-neutral-500">Contrat</dt><dd>{LIBELLES_TYPE_CONTRAT[employe.type_contrat]}</dd>
            <dt className="text-neutral-500">{employe.type_contrat === 'JOURNALIER' ? 'Taux journalier' : 'Salaire de base'}</dt><dd className="font-mono font-semibold">{formaterFcfa(employe.salaire_base)}</dd>
            <dt className="text-neutral-500">Début</dt><dd>{employe.date_debut ? formaterDate(employe.date_debut) : '—'}</dd>
            <dt className="text-neutral-500">Fin</dt><dd>{employe.date_fin ? formaterDate(employe.date_fin) : '—'}</dd>
            <dt className="text-neutral-500">Statut</dt><dd><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${employe.est_actif ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-600'}`}>{employe.est_actif ? 'Actif' : 'Inactif'}</span></dd>
            <dt className="text-neutral-500">Contrat joint</dt><dd>{employe.contrat_nom ?? '—'}</dd>
            {employe.notes && <><dt className="text-neutral-500">Notes</dt><dd className="col-span-1">{employe.notes}</dd></>}
          </dl>
        </div>
      </Modal>
      {modal === 'modifier' && <EmployeFormModal filialeId={filialeId} employe={employe} onClose={() => setModal(null)} />}
      {modal === 'contrat' && employe.contrat_fichier && (
        <Modal titre={`Contrat — ${employe.contrat_nom ?? nomComplet(employe)}`} largeur="max-w-4xl" onClose={() => setModal(null)}>
          {estPdf ? <iframe title="Contrat" src={employe.contrat_fichier} className="w-full h-[70vh] border border-neutral-200 rounded-lg" /> : <img src={employe.contrat_fichier} alt="Contrat" className="max-h-[70vh] mx-auto" />}
        </Modal>
      )}
    </>
  );
}

/** Effectif de la filiale : liste, fiches, activation, liste imprimable. */
export default function EffectifPanel({ filialeId, filiale }: Props) {
  const repository = useRepository(EmployesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const [recherche, setRecherche] = useState('');
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [modal, setModal] = useState<{ type: 'detail'; id: string } | { type: 'modifier'; e: Employe } | { type: 'imprimer' } | null>(null);
  const { employes, isLoading } = useEmployes(filialeId, { recherche, inclureInactifs });
  const masseSalariale = employes.filter((e) => e.est_actif && e.type_contrat !== 'JOURNALIER').reduce((s, e) => s + e.salaire_base, 0);

  const basculerActif = async (e: Employe) => {
    if (!(await confirmer({ message: `${e.est_actif ? 'Désactiver' : 'Réactiver'} ${nomComplet(e)} ?${e.est_actif ? ' La date de fin sera fixée à aujourd’hui.' : ''}`, libelleConfirmer: e.est_actif ? 'Désactiver' : 'Réactiver', danger: e.est_actif }))) return;
    try { await repository.setActif(e.id, !e.est_actif); notifier('succes', `${nomComplet(e)} ${e.est_actif ? 'désactivé' : 'réactivé'}.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.'); }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Effectif actif</p><p className="text-2xl font-bold mt-1">{employes.filter((e) => e.est_actif).length}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Masse salariale mensuelle (hors journaliers)</p><p className="text-2xl font-bold font-mono mt-1">{formaterFcfa(masseSalariale)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Journaliers</p><p className="text-2xl font-bold mt-1">{employes.filter((e) => e.est_actif && e.type_contrat === 'JOURNALIER').length}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Contrats joints</p><p className="text-2xl font-bold mt-1">{employes.filter((e) => e.contrat_nom).length} / {employes.length}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[16rem] max-w-md"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" /><input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Matricule, nom, fonction, téléphone…" className={`${inputClass} pl-10`} /></div>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={inclureInactifs} onChange={(e) => setInclureInactifs(e.target.checked)} className="rounded" /> Inclure les inactifs</label>
        <Bouton onClick={() => setModal({ type: 'imprimer' })} icone={PrinterIcon} tailleIcone="w-5 h-5" className="ml-auto flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Imprimer l'effectif</Bouton>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-3 w-12" /><th className="px-3 py-3 text-left">Matricule</th><th className="px-3 py-3 text-left">Nom et prénom</th><th className="px-3 py-3 text-left">Sexe</th><th className="px-3 py-3 text-left">Téléphone</th><th className="px-3 py-3 text-left">Fonction</th><th className="px-3 py-3 text-left">Contrat</th><th className="px-3 py-3 text-left">Début</th><th className="px-3 py-3 text-right">Salaire de base</th><th className="px-3 py-3 text-center">Statut</th><th className="px-3 py-3 text-center">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {employes.map((e) => (
              <tr key={e.id} className={`hover:bg-neutral-50 ${!e.est_actif ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2"><div className="w-9 h-9 rounded-full bg-neutral-100 overflow-hidden flex items-center justify-center">{e.photo ? <img src={e.photo} alt="" className="w-full h-full object-cover" /> : <UserCircleIcon className="w-7 h-7 text-neutral-300" />}</div></td>
                <td className="px-3 py-2 text-sm font-mono text-primary-700">{e.matricule}</td>
                <td className="px-3 py-2 text-sm font-medium text-neutral-900">{nomComplet(e)}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{e.sexe ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{e.telephone ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{e.fonction ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{LIBELLES_TYPE_CONTRAT[e.type_contrat]}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{e.date_debut ? formaterDate(e.date_debut) : '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(e.salaire_base)}{e.type_contrat === 'JOURNALIER' && <span className="text-xs text-neutral-400"> / j</span>}</td>
                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${e.est_actif ? 'bg-green-100 text-green-700' : 'bg-neutral-200 text-neutral-600'}`}>{e.est_actif ? 'Actif' : 'Inactif'}</span></td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <button onClick={() => setModal({ type: 'detail', id: e.id })} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Fiche employé"><EyeIcon className="w-4 h-4" /></button>
                    <button onClick={() => setModal({ type: 'modifier', e })} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700" title="Modifier"><PencilSquareIcon className="w-4 h-4" /></button>
                    <button onClick={() => basculerActif(e)} className={`px-2 py-1 rounded text-xs font-medium ${e.est_actif ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>{e.est_actif ? 'Désactiver' : 'Réactiver'}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && employes.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun employé.</div>}
      </div>

      {modal?.type === 'detail' && <DetailEmploye filialeId={filialeId} employeId={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === 'modifier' && <EmployeFormModal filialeId={filialeId} employe={modal.e} onClose={() => setModal(null)} />}
      {modal?.type === 'imprimer' && (
        <DocumentImprimable titre="Liste du personnel" filiale={filiale} onClose={() => setModal(null)}>
          <p>Éditée le {new Date().toLocaleDateString('fr-FR')} · {employes.length} employé(s)</p>
          <table className="document-liste">
            <thead><tr><th>Matricule</th><th>Nom et prénom</th><th>Sexe</th><th>Téléphone</th><th>Fonction</th><th>Contrat</th><th>Début</th><th>Statut</th></tr></thead>
            <tbody>{employes.map((e) => <tr key={e.id}><td>{e.matricule}</td><td>{nomComplet(e)}</td><td>{e.sexe ?? ''}</td><td>{e.telephone ?? ''}</td><td>{e.fonction ?? ''}</td><td>{LIBELLES_TYPE_CONTRAT[e.type_contrat]}</td><td>{e.date_debut ? formaterDate(e.date_debut) : ''}</td><td>{e.est_actif ? 'Actif' : 'Inactif'}</td></tr>)}</tbody>
            {/* Répété au bas de chaque page : une page détachée du reste doit
                dire d'où elle sort. */}
            <tfoot><tr><td colSpan={8} className="document-liste-pied">Liste du personnel · {filiale.nom} · {employes.length} employé(s) · éditée le {new Date().toLocaleDateString('fr-FR')}</td></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
