import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CIVILITES,
  LIBELLES_PERIODE_REGLEMENT_CLIENT,
  PERIODES_REGLEMENT_CLIENT,
  clientFormSchema,
  clientToFormInput,
  type Client,
  type ClientForm,
  type ClientFormInput,
} from '../../../core/clients';
import { ClientsRepository } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import { useGroupesClients } from './hooks';

interface Props {
  filialeId: string;
  client?: Client;
  onClose: () => void;
  onCreated?: (id: string) => void;
}

const FORM_VIDE: ClientFormInput = {
  code: '', raison_sociale: '', mobile: '', email: '', adresse: '', contact: '', solde_initial: 0, plafond_credit: 0,
  groupe: '', civilite: '', numero_compte: '', telephone: '', pays: "Côte d'Ivoire", ville: '', numero_rc: '', numero_cc: '', date_effet_solde: '',
  remise_percent: 0, prise_min_jour: 0, prise_max_jour: 0, periode_reglement: '', notes: '',
};

/** Fiche client : identification, contact, solde d'ouverture (dû ou avance) et conditions commerciales. */
export default function ClientFormModal({ filialeId, client, onClose, onCreated }: Props) {
  const repository = useRepository(ClientsRepository);
  const notifier = useNotifier();
  const groupes = useGroupesClients(filialeId);
  // Le solde d'ouverture est saisi en valeur absolue avec son sens ; en base, un avoir est négatif.
  const [sensSolde, setSensSolde] = useState<'DU' | 'AVANCE'>(client && client.solde_initial < 0 ? 'AVANCE' : 'DU');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ClientFormInput, unknown, ClientForm>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: client ? { ...clientToFormInput(client), solde_initial: Math.abs(client.solde_initial) } : FORM_VIDE,
  });
  const cls = (champ: keyof ClientFormInput) => `${inputClass} ${errors[champ] ? inputErrorClass : ''}`;
  const nombre = (champ: keyof ClientFormInput) => `${cls(champ)} text-right font-mono`;

  const onSubmit = async (form: ClientForm) => {
    if (form.code && (await repository.codeExiste(filialeId, form.code, client?.id))) {
      setError('code', { message: 'Ce code existe déjà' });
      return;
    }
    const valeurs = { ...form, solde_initial: sensSolde === 'AVANCE' ? -Math.abs(form.solde_initial) : Math.abs(form.solde_initial) };
    try {
      if (client) {
        await repository.update(client.id, valeurs);
        notifier('succes', `Client ${form.raison_sociale} modifié.`);
      } else {
        const id = await repository.create(filialeId, valeurs);
        notifier('succes', `Client ${form.raison_sociale} créé.`);
        // L'appelant peut rediriger après création (ex. vers le compte) ; sinon simple fermeture.
        if (onCreated) { onCreated(id); return; }
      }
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal
      titre={client ? `Modifier ${client.raison_sociale}` : 'Nouveau client'}
      largeur="max-w-3xl"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="client-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{client ? 'Enregistrer' : 'Créer'}</button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-4 gap-4">
          <FormField label="Groupe" erreur={errors.groupe?.message}>
            <input {...register('groupe')} list="groupes-clients" className={cls('groupe')} placeholder="Particuliers, BTP…" />
            <datalist id="groupes-clients">{groupes.map((g) => <option key={g} value={g} />)}</datalist>
          </FormField>
          <FormField label="Civilité" erreur={errors.civilite?.message}>
            <select {...register('civilite')} className={cls('civilite')}><option value="">—</option>{CIVILITES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </FormField>
          <FormField label="Code / abrégé" erreur={errors.code?.message}>
            <input {...register('code')} className={`${cls('code')} font-mono uppercase`} placeholder="Auto si vide" />
          </FormField>
          <FormField label="N° compte" erreur={errors.numero_compte?.message}>
            <input {...register('numero_compte')} className={`${cls('numero_compte')} font-mono`} />
          </FormField>
        </div>
        <FormField label="Raison sociale" obligatoire erreur={errors.raison_sociale?.message}>
          <input {...register('raison_sociale')} className={cls('raison_sociale')} autoFocus />
        </FormField>
        <div className="grid grid-cols-4 gap-4">
          <FormField label="Téléphone" erreur={errors.telephone?.message}><input {...register('telephone')} className={cls('telephone')} /></FormField>
          <FormField label="Mobile" erreur={errors.mobile?.message}><input {...register('mobile')} className={cls('mobile')} placeholder="07 00 00 00 00" /></FormField>
          <FormField label="Email" erreur={errors.email?.message} className="col-span-2"><input {...register('email')} className={cls('email')} placeholder="Nécessaire pour les relances" /></FormField>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <FormField label="Adresse" erreur={errors.adresse?.message} className="col-span-2"><input {...register('adresse')} className={cls('adresse')} /></FormField>
          <FormField label="Ville" erreur={errors.ville?.message}><input {...register('ville')} className={cls('ville')} /></FormField>
          <FormField label="Pays" erreur={errors.pays?.message}><input {...register('pays')} className={cls('pays')} /></FormField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <FormField label="Contact / interlocuteur" erreur={errors.contact?.message}><input {...register('contact')} className={cls('contact')} /></FormField>
          <FormField label="N° RC" erreur={errors.numero_rc?.message}><input {...register('numero_rc')} className={cls('numero_rc')} /></FormField>
          <FormField label="N° CC" erreur={errors.numero_cc?.message}><input {...register('numero_cc')} className={cls('numero_cc')} /></FormField>
        </div>
        <fieldset className="border border-neutral-200 rounded-lg p-3">
          <legend className="px-1 text-xs font-medium text-neutral-600">Solde d'ouverture</legend>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Montant" erreur={errors.solde_initial?.message}>
              <input type="number" step="1" min="0" {...register('solde_initial')} className={nombre('solde_initial')} />
            </FormField>
            <FormField label="Sens">
              <select value={sensSolde} onChange={(e) => setSensSolde(e.target.value as 'DU' | 'AVANCE')} className={inputClass} data-testid="sens-solde">
                <option value="DU">Montant dû (créance)</option>
                <option value="AVANCE">Avance versée (avoir)</option>
              </select>
            </FormField>
            <FormField label="Date d'effet" erreur={errors.date_effet_solde?.message}><input type="date" {...register('date_effet_solde')} className={cls('date_effet_solde')} /></FormField>
          </div>
        </fieldset>
        <fieldset className="border border-neutral-200 rounded-lg p-3">
          <legend className="px-1 text-xs font-medium text-neutral-600">Conditions commerciales</legend>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="Remise appliquée (%)" erreur={errors.remise_percent?.message}><input type="number" step="0.01" min="0" max="100" {...register('remise_percent')} className={nombre('remise_percent')} /></FormField>
            <FormField label="Plafond de crédit" erreur={errors.plafond_credit?.message}><input type="number" step="1" min="0" {...register('plafond_credit')} className={nombre('plafond_credit')} /></FormField>
            <FormField label="Période de règlement" erreur={errors.periode_reglement?.message}>
              <select {...register('periode_reglement')} className={cls('periode_reglement')}>
                <option value="">— Non précisée —</option>
                {PERIODES_REGLEMENT_CLIENT.map((p) => <option key={p} value={p}>{LIBELLES_PERIODE_REGLEMENT_CLIENT[p]}</option>)}
              </select>
            </FormField>
            <FormField label="Prise minimum / jour" erreur={errors.prise_min_jour?.message}><input type="number" step="1" min="0" {...register('prise_min_jour')} className={nombre('prise_min_jour')} /></FormField>
            <FormField label="Prise maximum / jour" erreur={errors.prise_max_jour?.message}><input type="number" step="1" min="0" {...register('prise_max_jour')} className={nombre('prise_max_jour')} /></FormField>
          </div>
          <p className="text-xs text-neutral-500 mt-2">La remise est proposée d'office sur ses tickets ; un plafond à 0 interdit la vente à crédit.</p>
        </fieldset>
        <FormField label="Notes" erreur={errors.notes?.message}><textarea rows={2} {...register('notes')} className={cls('notes')} /></FormField>
      </form>
    </Modal>
  );
}
