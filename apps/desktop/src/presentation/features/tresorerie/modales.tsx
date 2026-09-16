import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CATEGORIES_DEPENSE, CATEGORIES_RECETTE, LIBELLES_CATEGORIE, caisseFormSchema, operationSchema, transfertCaisseSchema,
  type Caisse, type CaisseForm, type CaisseFormInput, type OperationForm, type OperationFormInput, type TransfertCaisseForm, type TransfertCaisseFormInput,
} from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';

const pied = (onClose: () => void, form: string, libelle: string, disabled: boolean) => (
  <>
    <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
    <button type="submit" form={form} disabled={disabled} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{libelle}</button>
  </>
);

export function CaisseFormModal({ filialeId, caisse, onClose }: { filialeId: string; caisse?: Caisse; onClose: () => void }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<CaisseFormInput, unknown, CaisseForm>({
    resolver: zodResolver(caisseFormSchema),
    defaultValues: caisse ? { code: caisse.code, nom: caisse.nom, responsable: caisse.responsable ?? '' } : { code: '', nom: '', responsable: '' },
  });
  const onSubmit = async (form: CaisseForm) => {
    if (await repository.codeExiste(filialeId, form.code, caisse?.id)) { setError('code', { message: 'Ce code existe déjà' }); return; }
    try {
      if (caisse) await repository.updateCaisse(caisse.id, form); else await repository.createCaisse(filialeId, form);
      notifier('succes', `Caisse ${form.nom} ${caisse ? 'modifiée' : 'créée'}.`); onClose();
    } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.'); }
  };
  return (
    <Modal titre={caisse ? `Modifier ${caisse.nom}` : 'Nouvelle caisse'} largeur="max-w-lg" onClose={onClose} pied={pied(onClose, 'caisse-form', caisse ? 'Enregistrer' : 'Créer', isSubmitting)}>
      <form id="caisse-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Code" obligatoire erreur={errors.code?.message}><input {...register('code')} className={`${inputClass} ${errors.code ? inputErrorClass : ''} font-mono uppercase`} maxLength={10} autoFocus /></FormField>
          <FormField label="Nom" obligatoire erreur={errors.nom?.message} className="col-span-2"><input {...register('nom')} className={`${inputClass} ${errors.nom ? inputErrorClass : ''}`} /></FormField>
        </div>
        <FormField label="Responsable"><input {...register('responsable')} className={inputClass} /></FormField>
      </form>
    </Modal>
  );
}

export function OperationModal({ filialeId, caisses, type, onClose }: { filialeId: string; caisses: Caisse[]; type: 'RECETTE' | 'DEPENSE'; onClose: () => void }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const categories = type === 'RECETTE' ? CATEGORIES_RECETTE : CATEGORIES_DEPENSE;
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OperationFormInput, unknown, OperationForm>({
    resolver: zodResolver(operationSchema),
    defaultValues: { caisse_id: caisses[0]?.id ?? '', type, categorie: categories[0], montant: 0, description: '', reference: '' },
  });
  const cls = (c: keyof OperationFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const onSubmit = async (form: OperationForm) => {
    try {
      const numero = await repository.enregistrerOperation({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
      notifier('succes', `${type === 'RECETTE' ? 'Recette' : 'Dépense'} ${numero} de ${formaterFcfa(form.montant)} enregistrée.`); onClose();
    } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.'); }
  };
  return (
    <Modal titre={type === 'RECETTE' ? 'Nouvelle recette' : 'Nouvelle dépense'} largeur="max-w-lg" onClose={onClose} pied={pied(onClose, 'op-form', 'Enregistrer', isSubmitting)}>
      <form id="op-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <input type="hidden" {...register('type')} />
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Caisse" obligatoire erreur={errors.caisse_id?.message}><select {...register('caisse_id')} className={cls('caisse_id')}>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom} ({formaterFcfa(c.solde_actuel)})</option>)}</select></FormField>
          <FormField label="Catégorie" obligatoire erreur={errors.categorie?.message}><select {...register('categorie')} className={cls('categorie')}>{categories.map((c) => <option key={c} value={c}>{LIBELLES_CATEGORIE[c]}</option>)}</select></FormField>
        </div>
        <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} autoFocus /></FormField>
        <FormField label="Description" erreur={errors.description?.message}><input {...register('description')} className={cls('description')} /></FormField>
        <FormField label="Référence (facture, reçu…)" erreur={errors.reference?.message}><input {...register('reference')} className={cls('reference')} /></FormField>
      </form>
    </Modal>
  );
}

export function TransfertCaisseModal({ filialeId, caisses, onClose }: { filialeId: string; caisses: Caisse[]; onClose: () => void }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<TransfertCaisseFormInput, unknown, TransfertCaisseForm>({
    resolver: zodResolver(transfertCaisseSchema),
    defaultValues: { caisse_source_id: caisses[0]?.id ?? '', caisse_destination_id: caisses[1]?.id ?? '', montant: 0, motif: '' },
  });
  const cls = (c: keyof TransfertCaisseFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const onSubmit = async (form: TransfertCaisseForm) => {
    try {
      const numero = await repository.transferer({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
      notifier('succes', `Transfert ${numero} de ${formaterFcfa(form.montant)} effectué.`); onClose();
    } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Transfert impossible.'); }
  };
  return (
    <Modal titre="Transfert entre caisses" largeur="max-w-lg" onClose={onClose} pied={pied(onClose, 'trc-form', 'Transférer', isSubmitting)}>
      <form id="trc-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Depuis" obligatoire erreur={errors.caisse_source_id?.message}><select {...register('caisse_source_id')} className={cls('caisse_source_id')}>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom} ({formaterFcfa(c.solde_actuel)})</option>)}</select></FormField>
          <FormField label="Vers" obligatoire erreur={errors.caisse_destination_id?.message}><select {...register('caisse_destination_id')} className={cls('caisse_destination_id')}>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></FormField>
        </div>
        <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} autoFocus /></FormField>
        <FormField label="Motif" erreur={errors.motif?.message}><input {...register('motif')} className={cls('motif')} /></FormField>
      </form>
    </Modal>
  );
}
