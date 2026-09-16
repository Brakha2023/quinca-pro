import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { clientFormSchema, clientToFormInput, type Client, type ClientForm, type ClientFormInput } from '../../../core/clients';
import { ClientsRepository } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

interface Props {
  filialeId: string;
  client?: Client;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

const FORM_VIDE: ClientFormInput = { code: '', raison_sociale: '', mobile: '', email: '', adresse: '', contact: '', solde_initial: 0, plafond_credit: 0 };

export default function ClientFormModal({ filialeId, client, onClose, onCreated }: Props) {
  const repository = useRepository(ClientsRepository);
  const notifier = useNotifier();
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ClientFormInput, unknown, ClientForm>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? clientToFormInput(client) : FORM_VIDE,
  });
  const cls = (champ: keyof ClientFormInput) => `${inputClass} ${errors[champ] ? inputErrorClass : ''}`;

  const onSubmit = async (form: ClientForm) => {
    if (form.code && (await repository.codeExiste(filialeId, form.code, client?.id))) {
      setError('code', { message: 'Ce code existe déjà' });
      return;
    }
    try {
      if (client) {
        await repository.update(client.id, form);
        notifier('succes', `Client ${form.raison_sociale} modifié.`);
      } else {
        const id = await repository.create(filialeId, form);
        notifier('succes', `Client ${form.raison_sociale} créé.`);
        onCreated?.(id);
      }
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal
      titre={client ? `Modifier ${client.raison_sociale}` : 'Nouveau client'}
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="client-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{client ? 'Enregistrer' : 'Créer'}</button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Code" erreur={errors.code?.message}>
            <input {...register('code')} className={`${cls('code')} font-mono uppercase`} placeholder="Auto si vide" />
          </FormField>
          <FormField label="Raison sociale" obligatoire erreur={errors.raison_sociale?.message} className="col-span-2">
            <input {...register('raison_sociale')} className={cls('raison_sociale')} autoFocus />
          </FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Mobile" erreur={errors.mobile?.message}><input {...register('mobile')} className={cls('mobile')} placeholder="07 00 00 00 00" /></FormField>
          <FormField label="Email" erreur={errors.email?.message}><input {...register('email')} className={cls('email')} /></FormField>
          <FormField label="Contact" erreur={errors.contact?.message}><input {...register('contact')} className={cls('contact')} /></FormField>
        </div>
        <FormField label="Adresse" erreur={errors.adresse?.message}><input {...register('adresse')} className={cls('adresse')} /></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Solde d'ouverture (créance initiale)" erreur={errors.solde_initial?.message}>
            <input type="number" step="1" {...register('solde_initial')} className={`${cls('solde_initial')} text-right font-mono`} />
          </FormField>
          <FormField label="Plafond de crédit" erreur={errors.plafond_credit?.message}>
            <input type="number" step="1" min="0" {...register('plafond_credit')} className={`${cls('plafond_credit')} text-right font-mono`} />
          </FormField>
        </div>
        <p className="text-xs text-neutral-500">Un plafond à 0 interdit la vente à crédit pour ce client.</p>
      </form>
    </Modal>
  );
}
