import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { fournisseurFormSchema, fournisseurToFormInput, type Fournisseur, type FournisseurForm, type FournisseurFormInput } from '../../../core/fournisseurs';
import { FournisseursRepository } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

const FORM_VIDE: FournisseurFormInput = { code: '', raison_sociale: '', numero_compte: '', famille: '', type_article: '', telephone: '', email: '', adresse: '', solde_initial: 0, plafond_credit: 0 };

export default function FournisseurFormModal({ filialeId, fournisseur, onClose }: { filialeId: string; fournisseur?: Fournisseur; onClose: () => void }) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FournisseurFormInput, unknown, FournisseurForm>({
    resolver: zodResolver(fournisseurFormSchema),
    defaultValues: fournisseur ? fournisseurToFormInput(fournisseur) : FORM_VIDE,
  });
  const cls = (c: keyof FournisseurFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;

  const onSubmit = async (form: FournisseurForm) => {
    if (form.code && (await repository.codeExiste(filialeId, form.code, fournisseur?.id))) { setError('code', { message: 'Ce code existe déjà' }); return; }
    try {
      if (fournisseur) { await repository.update(fournisseur.id, form); notifier('succes', `Fournisseur ${form.raison_sociale} modifié.`); }
      else { await repository.create(filialeId, form); notifier('succes', `Fournisseur ${form.raison_sociale} créé.`); }
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal titre={fournisseur ? `Modifier ${fournisseur.raison_sociale}` : 'Nouveau fournisseur'} onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="submit" form="fournisseur-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{fournisseur ? 'Enregistrer' : 'Créer'}</button>
      </>
    }>
      <form id="fournisseur-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Code" erreur={errors.code?.message}><input {...register('code')} className={`${cls('code')} font-mono uppercase`} placeholder="Auto si vide" /></FormField>
          <FormField label="Raison sociale" obligatoire erreur={errors.raison_sociale?.message} className="col-span-2"><input {...register('raison_sociale')} className={cls('raison_sociale')} autoFocus /></FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="N° compte comptable" erreur={errors.numero_compte?.message}><input {...register('numero_compte')} className={cls('numero_compte')} /></FormField>
          <FormField label="Famille" erreur={errors.famille?.message}><input {...register('famille')} className={cls('famille')} placeholder="Matériaux, Sanitaire…" /></FormField>
          <FormField label="Type d'articles" erreur={errors.type_article?.message}><input {...register('type_article')} className={cls('type_article')} /></FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Téléphone" erreur={errors.telephone?.message}><input {...register('telephone')} className={cls('telephone')} /></FormField>
          <FormField label="Email" erreur={errors.email?.message}><input {...register('email')} className={cls('email')} /></FormField>
          <FormField label="Adresse" erreur={errors.adresse?.message}><input {...register('adresse')} className={cls('adresse')} /></FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Dette d'ouverture" erreur={errors.solde_initial?.message}><input type="number" step="1" {...register('solde_initial')} className={`${cls('solde_initial')} text-right font-mono`} /></FormField>
          <FormField label="Plafond de crédit accordé" erreur={errors.plafond_credit?.message}><input type="number" step="1" min="0" {...register('plafond_credit')} className={`${cls('plafond_credit')} text-right font-mono`} /></FormField>
        </div>
      </form>
    </Modal>
  );
}
