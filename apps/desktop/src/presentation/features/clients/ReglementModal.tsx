import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TYPES_REGLEMENT } from '@quinca/shared-types';
import { LIBELLES_TYPE_REGLEMENT, reglementFormSchema, type Client, type ReglementForm, type ReglementFormInput } from '../../../core/clients';
import { ClientsRepository } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useCaisses } from './hooks';

interface Props {
  filialeId: string;
  client: Client;
  onClose: () => void;
}

/** Encaissement d'un règlement client (créance ou acompte) sur une caisse. */
export default function ReglementModal({ filialeId, client, onClose }: Props) {
  const repository = useRepository(ClientsRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const caisses = useCaisses(filialeId);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ReglementFormInput, unknown, ReglementForm>({
    resolver: zodResolver(reglementFormSchema),
    defaultValues: { montant: Math.max(client.solde_actuel, 0) || 0, type_reglement: 'ESPECES', caisse_id: '', reference: '', date_reglement: new Date().toISOString().slice(0, 10) },
  });
  const montant = Number(watch('montant')) || 0;
  const cls = (champ: keyof ReglementFormInput) => `${inputClass} ${errors[champ] ? inputErrorClass : ''}`;

  const onSubmit = async (form: ReglementForm) => {
    try {
      const numero = await repository.enregistrerReglement({ filialeId, utilisateurId: utilisateur?.id ?? null }, client.id, form);
      notifier('succes', `Règlement ${numero} de ${formaterFcfa(form.montant)} enregistré.`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal
      titre={`Règlement — ${client.raison_sociale}`}
      sousTitre={`Créance actuelle : ${formaterFcfa(client.solde_actuel)}`}
      largeur="max-w-lg"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="reglement-form" disabled={isSubmitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">Encaisser</button>
        </>
      }
    >
      <form id="reglement-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Montant" obligatoire erreur={errors.montant?.message}>
            <input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} autoFocus />
          </FormField>
          <FormField label="Date" erreur={errors.date_reglement?.message}>
            <input type="date" {...register('date_reglement')} className={cls('date_reglement')} />
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Mode" obligatoire erreur={errors.type_reglement?.message}>
            <select {...register('type_reglement')} className={cls('type_reglement')}>
              {TYPES_REGLEMENT.map((t) => <option key={t} value={t}>{LIBELLES_TYPE_REGLEMENT[t]}</option>)}
            </select>
          </FormField>
          <FormField label="Caisse" obligatoire erreur={errors.caisse_id?.message}>
            <select {...register('caisse_id')} className={cls('caisse_id')}>
              <option value="">— Choisir —</option>
              {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </FormField>
        </div>
        <FormField label="Référence (n° chèque, transaction…)" erreur={errors.reference?.message}>
          <input {...register('reference')} className={cls('reference')} />
        </FormField>
        <p className="text-sm text-neutral-600">
          Créance après règlement : <span className={`font-mono font-semibold ${client.solde_actuel - montant < 0 ? 'text-blue-700' : 'text-neutral-900'}`}>{formaterFcfa(client.solde_actuel - montant)}</span>
          {client.solde_actuel - montant < 0 && <span className="text-xs text-blue-700 ml-2">(avoir : acompte utilisable sur les prochaines ventes)</span>}
        </p>
      </form>
    </Modal>
  );
}
