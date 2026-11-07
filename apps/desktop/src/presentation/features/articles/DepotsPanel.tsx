import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BuildingStorefrontIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { depotFormSchema, type Depot, type DepotForm, type DepotFormInput } from '../../../core/articles';
import { DepotsRepository } from '../../../infrastructure/powersync/repositories/DepotsRepository';
import Carte from '../../components/ui/Carte';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from './hooks';

interface Props {
  filialeId: string;
}

function DepotFormModal({ filialeId, depot, onClose }: { filialeId: string; depot?: Depot; onClose: () => void }) {
  const repository = useRepository(DepotsRepository);
  const notifier = useNotifier();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DepotFormInput, unknown, DepotForm>({
    resolver: zodResolver(depotFormSchema),
    defaultValues: depot
      ? { code: depot.code, nom: depot.nom, adresse: depot.adresse ?? '', responsable: depot.responsable ?? '' }
      : { code: '', nom: '', adresse: '', responsable: '' },
  });

  const onSubmit = async (form: DepotForm) => {
    if (await repository.codeExiste(filialeId, form.code, depot?.id)) {
      setError('code', { message: 'Ce code existe déjà' });
      return;
    }
    try {
      if (depot) {
        await repository.update(depot.id, form);
        notifier('succes', `Dépôt ${form.nom} modifié.`);
      } else {
        await repository.create(filialeId, form);
        notifier('succes', `Dépôt ${form.nom} créé.`);
      }
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal
      titre={depot ? `Modifier ${depot.nom}` : 'Nouveau dépôt'}
      largeur="max-w-lg"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="depot-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">
            {depot ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <form id="depot-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Code" obligatoire erreur={errors.code?.message}>
            <input {...register('code')} className={`${inputClass} ${errors.code ? inputErrorClass : ''} font-mono uppercase`} maxLength={10} autoFocus />
          </FormField>
          <FormField label="Nom" obligatoire erreur={errors.nom?.message} className="col-span-2">
            <input {...register('nom')} className={`${inputClass} ${errors.nom ? inputErrorClass : ''}`} />
          </FormField>
        </div>
        <FormField label="Adresse" erreur={errors.adresse?.message}>
          <input {...register('adresse')} className={inputClass} />
        </FormField>
        <FormField label="Responsable" erreur={errors.responsable?.message}>
          <input {...register('responsable')} className={inputClass} />
        </FormField>
      </form>
    </Modal>
  );
}

export default function DepotsPanel({ filialeId }: Props) {
  const repository = useRepository(DepotsRepository);
  const notifier = useNotifier();
  const { depots, isLoading } = useDepots(filialeId);
  const [modal, setModal] = useState<{ depot?: Depot } | null>(null);

  const basculerActif = async (depot: Depot) => {
    try {
      await repository.setActif(depot.id, !depot.est_actif);
      notifier('succes', `Dépôt ${depot.nom} ${depot.est_actif ? 'désactivé' : 'réactivé'}.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-600"><strong>{depots.length}</strong> dépôt(s)</p>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-3 py-2 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-lg text-sm">
          <PlusIcon className="w-4 h-4" /> Nouveau dépôt
        </button>
      </div>

      <Carte titre="Dépôts" icone={BuildingStorefrontIcon} sous={`${depots.length} dépôt(s)`} nu>
        <div className="overflow-x-auto">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Nom</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Adresse</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Responsable</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase">Statut</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {depots.map((d) => (
              <tr key={d.id} className={`hover:bg-neutral-50 ${!d.est_actif ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 text-sm font-mono font-medium text-primary-700">{d.code}</td>
                <td className="px-3 py-2 text-sm font-medium text-neutral-900">{d.nom}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{d.adresse || '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{d.responsable || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${d.est_actif ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>
                    {d.est_actif ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center print:hidden">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal({ depot: d })} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Modifier">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => basculerActif(d)} className={`px-2 py-1 rounded text-xs font-medium ${d.est_actif ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>
                      {d.est_actif ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && depots.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun dépôt</div>}
      </Carte>

      {modal && <DepotFormModal filialeId={filialeId} depot={modal.depot} onClose={() => setModal(null)} />}
    </div>
  );
}
