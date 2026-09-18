import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { PaperClipIcon, TrashIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import { SEXES, TYPES_CONTRAT } from '@quinca/shared-types';
import {
  LIBELLES_SEXE, LIBELLES_TYPE_CONTRAT, TAILLE_MAX_CONTRAT, TAILLE_MAX_PHOTO, TYPES_CONTRAT_FICHIER,
  employeFormSchema, employeToFormInput, type Employe, type EmployeForm, type EmployeFormInput,
} from '../../../core/employes';
import { lireFichierDataUrl, redimensionnerImage, tailleDataUrl } from '../../../infrastructure/fichiers/piecesJointes';
import { EmployesRepository } from '../../../infrastructure/powersync/repositories/EmployesRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

interface Props {
  filialeId: string;
  employe?: Employe;
  onClose: () => void;
  onEnregistre?: (id: string) => void;
}

const FORM_VIDE: EmployeFormInput = {
  matricule: '', nom: '', prenom: '', sexe: '', telephone: '', fonction: '', date_debut: new Date().toISOString().slice(0, 10), date_fin: '',
  type_contrat: 'CDI', salaire_base: 0, est_actif: true, photo: null, contrat_nom: null, contrat_fichier: null, notes: '',
};

/** Fiche employé : identité, contrat (type, dates, salaire de base), photo et contrat joint, statut. */
export default function EmployeFormModal({ filialeId, employe, onClose, onEnregistre }: Props) {
  const repository = useRepository(EmployesRepository);
  const notifier = useNotifier();
  const { register, handleSubmit, setError, setValue, watch, formState: { errors, isSubmitting } } = useForm<EmployeFormInput, unknown, EmployeForm>({
    resolver: zodResolver(employeFormSchema),
    defaultValues: employe ? employeToFormInput(employe) : FORM_VIDE,
  });
  const [chargement, setChargement] = useState<'photo' | 'contrat' | null>(null);
  const photo = watch('photo');
  const contratNom = watch('contrat_nom');
  const cls = (c: keyof EmployeFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;

  const choisirPhoto = async (fichier: File | undefined) => {
    if (!fichier) return;
    if (!fichier.type.startsWith('image/')) { notifier('erreur', 'La photo doit être une image.'); return; }
    setChargement('photo');
    try {
      const data = await redimensionnerImage(fichier);
      if (tailleDataUrl(data) > TAILLE_MAX_PHOTO) { notifier('erreur', 'Photo trop lourde même réduite.'); return; }
      setValue('photo', data, { shouldDirty: true });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Photo illisible.');
    } finally {
      setChargement(null);
    }
  };

  const choisirContrat = async (fichier: File | undefined) => {
    if (!fichier) return;
    if (!TYPES_CONTRAT_FICHIER.includes(fichier.type)) { notifier('erreur', 'Le contrat doit être un PDF ou une image (JPEG, PNG).'); return; }
    if (fichier.size > TAILLE_MAX_CONTRAT) { notifier('erreur', 'Le contrat dépasse 1 Mo : réduisez le scan avant de le joindre.'); return; }
    setChargement('contrat');
    try {
      setValue('contrat_fichier', await lireFichierDataUrl(fichier), { shouldDirty: true });
      setValue('contrat_nom', fichier.name, { shouldDirty: true });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Fichier illisible.');
    } finally {
      setChargement(null);
    }
  };

  const onSubmit = async (form: EmployeForm) => {
    if (form.matricule && (await repository.matriculeExiste(filialeId, form.matricule, employe?.id))) { setError('matricule', { message: 'Ce matricule existe déjà' }); return; }
    try {
      let id = employe?.id ?? '';
      if (employe) { await repository.update(employe.id, form); notifier('succes', `Fiche de ${form.prenom} ${form.nom} modifiée.`); }
      else { id = await repository.create(filialeId, form); notifier('succes', `Employé ${form.prenom} ${form.nom} créé.`); }
      if (onEnregistre) onEnregistre(id); else onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal titre={employe ? `Modifier ${employe.prenom ?? ''} ${employe.nom}`.trim() : 'Nouvel employé'} largeur="max-w-3xl" onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="submit" form="employe-form" disabled={isSubmitting || chargement !== null} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{employe ? 'Enregistrer' : 'Créer'}</button>
      </>
    }>
      <form id="employe-form" onSubmit={handleSubmit(onSubmit)} className="flex gap-6">
        <div className="w-40 shrink-0 space-y-3">
          <div className="w-40 h-40 rounded-xl bg-neutral-100 border border-neutral-200 overflow-hidden flex items-center justify-center">
            {photo ? <img src={photo} alt="Photo" className="w-full h-full object-cover" /> : <UserCircleIcon className="w-20 h-20 text-neutral-300" />}
          </div>
          <label className="block text-center text-sm font-medium text-primary-700 hover:underline cursor-pointer">
            {chargement === 'photo' ? 'Chargement…' : photo ? 'Changer la photo' : 'Ajouter une photo'}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => choisirPhoto(e.target.files?.[0])} data-testid="photo-input" />
          </label>
          {photo && <button type="button" onClick={() => setValue('photo', null, { shouldDirty: true })} className="block mx-auto text-xs text-red-600 hover:underline">Retirer la photo</button>}
          <label className="flex items-center gap-2 text-sm cursor-pointer justify-center"><input type="checkbox" {...register('est_actif')} className="rounded" /> Actif</label>
        </div>
        <div className="flex-1 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Matricule" erreur={errors.matricule?.message}><input {...register('matricule')} className={`${cls('matricule')} font-mono uppercase`} placeholder="Auto si vide" /></FormField>
            <FormField label="Nom" obligatoire erreur={errors.nom?.message}><input {...register('nom')} className={cls('nom')} autoFocus /></FormField>
            <FormField label="Prénom" erreur={errors.prenom?.message}><input {...register('prenom')} className={cls('prenom')} /></FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Sexe" erreur={errors.sexe?.message}><select {...register('sexe')} className={cls('sexe')}><option value="">—</option>{SEXES.map((s) => <option key={s} value={s}>{LIBELLES_SEXE[s]}</option>)}</select></FormField>
            <FormField label="Téléphone" erreur={errors.telephone?.message}><input {...register('telephone')} className={cls('telephone')} /></FormField>
            <FormField label="Fonction" erreur={errors.fonction?.message}><input {...register('fonction')} className={cls('fonction')} placeholder="Caissier, magasinier…" /></FormField>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <FormField label="Type de contrat" obligatoire erreur={errors.type_contrat?.message}><select {...register('type_contrat')} className={cls('type_contrat')}>{TYPES_CONTRAT.map((t) => <option key={t} value={t}>{LIBELLES_TYPE_CONTRAT[t]}</option>)}</select></FormField>
            <FormField label="Date de début" erreur={errors.date_debut?.message}><input type="date" {...register('date_debut')} className={cls('date_debut')} /></FormField>
            <FormField label="Date de fin" erreur={errors.date_fin?.message}><input type="date" {...register('date_fin')} className={cls('date_fin')} /></FormField>
            <FormField label={watch('type_contrat') === 'JOURNALIER' ? 'Taux journalier' : 'Salaire de base'} obligatoire erreur={errors.salaire_base?.message}><input type="number" step="1" min="0" {...register('salaire_base')} className={`${cls('salaire_base')} text-right font-mono`} /></FormField>
          </div>
          <FormField label="Contrat joint (PDF ou image, 1 Mo max)" erreur={errors.contrat_fichier?.message}>
            <div className="flex items-center gap-3">
              <label className={`${inputClass} flex items-center gap-2 cursor-pointer w-auto`}>
                <PaperClipIcon className="w-4 h-4" /> {chargement === 'contrat' ? 'Chargement…' : contratNom ? 'Remplacer' : 'Joindre le contrat'}
                <input type="file" accept=".pdf,image/jpeg,image/png" className="hidden" onChange={(e) => choisirContrat(e.target.files?.[0])} data-testid="contrat-input" />
              </label>
              {contratNom && <span className="text-sm text-neutral-700 truncate">{contratNom}</span>}
              {contratNom && <button type="button" onClick={() => { setValue('contrat_fichier', null, { shouldDirty: true }); setValue('contrat_nom', null, { shouldDirty: true }); }} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Retirer"><TrashIcon className="w-4 h-4" /></button>}
            </div>
          </FormField>
          <FormField label="Notes" erreur={errors.notes?.message}><textarea rows={2} {...register('notes')} className={cls('notes')} /></FormField>
        </div>
      </form>
    </Modal>
  );
}
