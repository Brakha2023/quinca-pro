import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { familleFormSchema, type FamilleArticle, type FamilleForm, type FamilleFormInput } from '../../../core/articles';
import { FamillesRepository } from '../../../infrastructure/powersync/repositories/FamillesRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useFamilles } from './hooks';

interface Props {
  filialeId: string;
}

function FamilleFormModal({ filialeId, famille, onClose }: { filialeId: string; famille?: FamilleArticle; onClose: () => void }) {
  const repository = useRepository(FamillesRepository);
  const notifier = useNotifier();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FamilleFormInput, unknown, FamilleForm>({
    resolver: zodResolver(familleFormSchema),
    defaultValues: famille
      ? { code: famille.code, nom: famille.nom, description: famille.description ?? '' }
      : { code: '', nom: '', description: '' },
  });

  const onSubmit = async (form: FamilleForm) => {
    if (await repository.codeExiste(filialeId, form.code, famille?.id)) {
      setError('code', { message: 'Ce code existe déjà' });
      return;
    }
    try {
      if (famille) {
        await repository.update(famille.id, form);
        notifier('succes', `Famille ${form.nom} modifiée.`);
      } else {
        await repository.create(filialeId, form);
        notifier('succes', `Famille ${form.nom} créée.`);
      }
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal
      titre={famille ? `Modifier ${famille.nom}` : 'Nouvelle famille'}
      largeur="max-w-lg"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="famille-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">
            {famille ? 'Enregistrer' : 'Créer'}
          </button>
        </>
      }
    >
      <form id="famille-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Code" obligatoire erreur={errors.code?.message}>
            <input {...register('code')} className={`${inputClass} ${errors.code ? inputErrorClass : ''} font-mono uppercase`} maxLength={10} autoFocus />
          </FormField>
          <FormField label="Nom" obligatoire erreur={errors.nom?.message} className="col-span-2">
            <input {...register('nom')} className={`${inputClass} ${errors.nom ? inputErrorClass : ''} uppercase`} />
          </FormField>
        </div>
        <FormField label="Description" erreur={errors.description?.message}>
          <input {...register('description')} className={inputClass} />
        </FormField>
      </form>
    </Modal>
  );
}

export default function FamillesPanel({ filialeId }: Props) {
  const repository = useRepository(FamillesRepository);
  const notifier = useNotifier();
  const { familles, isLoading } = useFamilles(filialeId);
  const [modal, setModal] = useState<{ famille?: FamilleArticle } | null>(null);

  const basculerActive = async (famille: FamilleArticle) => {
    try {
      await repository.setActive(famille.id, !famille.est_active);
      notifier('succes', `Famille ${famille.nom} ${famille.est_active ? 'désactivée' : 'réactivée'}.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <p className="text-sm text-neutral-600"><strong>{familles.length}</strong> famille(s)</p>
        <button onClick={() => setModal({})} className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg text-sm">
          <PlusIcon className="w-4 h-4" /> Nouvelle famille
        </button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Code</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Nom</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-neutral-600 uppercase">Description</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase">Statut</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-neutral-600 uppercase print:hidden">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {familles.map((f) => (
              <tr key={f.id} className={`hover:bg-neutral-50 ${!f.est_active ? 'opacity-50' : ''}`}>
                <td className="px-3 py-2 text-sm font-mono font-medium text-primary-700">{f.code}</td>
                <td className="px-3 py-2 text-sm font-medium text-neutral-900">{f.nom}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{f.description || '—'}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${f.est_active ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-600'}`}>
                    {f.est_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-3 py-2 text-center print:hidden">
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal({ famille: f })} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Modifier">
                      <PencilSquareIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => basculerActive(f)} className={`px-2 py-1 rounded text-xs font-medium ${f.est_active ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>
                      {f.est_active ? 'Désactiver' : 'Réactiver'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && familles.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune famille</div>}
      </div>

      {modal && <FamilleFormModal filialeId={filialeId} famille={modal.famille} onClose={() => setModal(null)} />}
    </div>
  );
}
