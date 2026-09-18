import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  LIBELLES_PERIODE_REGLEMENT,
  PERIODES_REGLEMENT,
  fournisseurFormSchema,
  fournisseurToFormInput,
  type Fournisseur,
  type FournisseurForm,
  type FournisseurFormInput,
} from '../../../core/fournisseurs';
import { FournisseursRepository } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

const FORM_VIDE: FournisseurFormInput = {
  code: '', raison_sociale: '', numero_compte: '', famille: '', type_article: '', telephone: '', email: '', adresse: '', solde_initial: 0, plafond_credit: 0,
  mobile: '', numero_rc: '', numero_cc: '', interlocuteur: '', mobile_interlocuteur: '', date_effet_solde: '', periode_reglement: '',
  delai_echeance_jours: 0, avance_confirmation_percent: 0, pourcentage_echeance: 0, banque: '', numero_compte_bancaire: '', notes: '',
};

type Onglet = 'identification' | 'banque' | 'complement';
const ONGLETS: Array<{ id: Onglet; label: string }> = [
  { id: 'identification', label: 'Identification' },
  { id: 'banque', label: 'Banque' },
  { id: 'complement', label: 'Complément' },
];

/** Fiche fournisseur : identification et contact, conditions de règlement et de commande, coordonnées bancaires, notes. */
export default function FournisseurFormModal({ filialeId, fournisseur, onClose, onEnregistre }: { filialeId: string; fournisseur?: Fournisseur; onClose: () => void; onEnregistre?: (id: string) => void }) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const [onglet, setOnglet] = useState<Onglet>('identification');
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<FournisseurFormInput, unknown, FournisseurForm>({
    resolver: zodResolver(fournisseurFormSchema),
    defaultValues: fournisseur ? fournisseurToFormInput(fournisseur) : FORM_VIDE,
  });
  const cls = (c: keyof FournisseurFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const nombre = (c: keyof FournisseurFormInput) => `${cls(c)} text-right font-mono`;

  const onSubmit = async (form: FournisseurForm) => {
    if (form.code && (await repository.codeExiste(filialeId, form.code, fournisseur?.id))) { setOnglet('identification'); setError('code', { message: 'Ce code existe déjà' }); return; }
    try {
      let id = fournisseur?.id ?? '';
      if (fournisseur) { await repository.update(fournisseur.id, form); notifier('succes', `Fournisseur ${form.raison_sociale} modifié.`); }
      else { id = await repository.create(filialeId, form); notifier('succes', `Fournisseur ${form.raison_sociale} créé.`); }
      // Après enregistrement, l'appelant peut rediriger (ex. vers le compte) ; sinon simple fermeture.
      if (onEnregistre) onEnregistre(id); else onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  // Une erreur sur un onglet caché doit rester visible : on ramène l'utilisateur au premier onglet fautif.
  const onInvalide = () => {
    const champs = Object.keys(errors) as Array<keyof FournisseurFormInput>;
    if (champs.some((c) => ['banque', 'numero_compte_bancaire'].includes(c))) setOnglet('banque');
    else if (champs.some((c) => c === 'notes')) setOnglet('complement');
    else setOnglet('identification');
  };

  return (
    <Modal titre={fournisseur ? `Modifier ${fournisseur.raison_sociale}` : 'Nouveau fournisseur'} largeur="max-w-3xl" onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="submit" form="fournisseur-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{fournisseur ? 'Enregistrer' : 'Créer'}</button>
      </>
    }>
      <div className="flex gap-1 border-b border-neutral-200 mb-4">
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" onClick={() => setOnglet(o.id)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${onglet === o.id ? 'border-primary-600 text-primary-700' : 'border-transparent text-neutral-500 hover:text-neutral-800'}`}>{o.label}</button>
        ))}
      </div>
      <form id="fournisseur-form" onSubmit={handleSubmit(onSubmit, onInvalide)} className="space-y-4">
        <div className={onglet === 'identification' ? 'space-y-4' : 'hidden'}>
          <div className="grid grid-cols-4 gap-4">
            <FormField label="Famille" erreur={errors.famille?.message}><input {...register('famille')} className={cls('famille')} placeholder="Matériaux, Sanitaire…" /></FormField>
            <FormField label="Code" erreur={errors.code?.message}><input {...register('code')} className={`${cls('code')} font-mono uppercase`} placeholder="Auto si vide" /></FormField>
            <FormField label="Raison sociale" obligatoire erreur={errors.raison_sociale?.message} className="col-span-2"><input {...register('raison_sociale')} className={cls('raison_sociale')} autoFocus /></FormField>
          </div>
          <div className="grid grid-cols-4 gap-4">
            <FormField label="Téléphone" erreur={errors.telephone?.message}><input {...register('telephone')} className={cls('telephone')} /></FormField>
            <FormField label="Mobile" erreur={errors.mobile?.message}><input {...register('mobile')} className={cls('mobile')} /></FormField>
            <FormField label="Email" erreur={errors.email?.message} className="col-span-2"><input {...register('email')} className={cls('email')} placeholder="Nécessaire pour les relances" /></FormField>
          </div>
          <FormField label="Adresse" erreur={errors.adresse?.message}><input {...register('adresse')} className={cls('adresse')} /></FormField>
          <div className="grid grid-cols-3 gap-4">
            <FormField label="N° compte comptable" erreur={errors.numero_compte?.message}><input {...register('numero_compte')} className={`${cls('numero_compte')} font-mono`} /></FormField>
            <FormField label="N° RC" erreur={errors.numero_rc?.message}><input {...register('numero_rc')} className={cls('numero_rc')} /></FormField>
            <FormField label="N° CC" erreur={errors.numero_cc?.message}><input {...register('numero_cc')} className={cls('numero_cc')} /></FormField>
          </div>
          <fieldset className="border border-neutral-200 rounded-lg p-3">
            <legend className="px-1 text-xs font-medium text-neutral-600">Contact</legend>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Interlocuteur" erreur={errors.interlocuteur?.message}><input {...register('interlocuteur')} className={cls('interlocuteur')} /></FormField>
              <FormField label="Mobile interlocuteur" erreur={errors.mobile_interlocuteur?.message}><input {...register('mobile_interlocuteur')} className={cls('mobile_interlocuteur')} /></FormField>
              <FormField label="Type d'articles" erreur={errors.type_article?.message}><input {...register('type_article')} className={cls('type_article')} /></FormField>
            </div>
          </fieldset>
          <div className="grid grid-cols-4 gap-4">
            <FormField label="Solde initial (dette d'ouverture)" erreur={errors.solde_initial?.message}><input type="number" step="1" {...register('solde_initial')} className={nombre('solde_initial')} /></FormField>
            <FormField label="Date d'effet" erreur={errors.date_effet_solde?.message}><input type="date" {...register('date_effet_solde')} className={cls('date_effet_solde')} /></FormField>
            <FormField label="Période de règlement" erreur={errors.periode_reglement?.message}>
              <select {...register('periode_reglement')} className={cls('periode_reglement')}>
                <option value="">— Non précisée —</option>
                {PERIODES_REGLEMENT.map((p) => <option key={p} value={p}>{LIBELLES_PERIODE_REGLEMENT[p]}</option>)}
              </select>
            </FormField>
            <FormField label="Plafond de crédit" erreur={errors.plafond_credit?.message}><input type="number" step="1" min="0" {...register('plafond_credit')} className={nombre('plafond_credit')} /></FormField>
          </div>
          <fieldset className="border border-neutral-200 rounded-lg p-3">
            <legend className="px-1 text-xs font-medium text-neutral-600">Conditions de commande</legend>
            <div className="grid grid-cols-3 gap-4">
              <FormField label="Délai d'échéance accordé (jours)" erreur={errors.delai_echeance_jours?.message}><input type="number" step="1" min="0" {...register('delai_echeance_jours')} className={nombre('delai_echeance_jours')} /></FormField>
              <FormField label="Avance à la confirmation (%)" erreur={errors.avance_confirmation_percent?.message}><input type="number" step="0.01" min="0" max="100" {...register('avance_confirmation_percent')} className={nombre('avance_confirmation_percent')} /></FormField>
              <FormField label="Pourcentage payé par échéance (%)" erreur={errors.pourcentage_echeance?.message}><input type="number" step="0.01" min="0" max="100" {...register('pourcentage_echeance')} className={nombre('pourcentage_echeance')} /></FormField>
            </div>
          </fieldset>
        </div>

        <div className={onglet === 'banque' ? 'grid grid-cols-2 gap-4' : 'hidden'}>
          <FormField label="Banque" erreur={errors.banque?.message}><input {...register('banque')} className={cls('banque')} /></FormField>
          <FormField label="N° de compte bancaire / RIB" erreur={errors.numero_compte_bancaire?.message}><input {...register('numero_compte_bancaire')} className={`${cls('numero_compte_bancaire')} font-mono`} /></FormField>
        </div>

        <div className={onglet === 'complement' ? '' : 'hidden'}>
          <FormField label="Notes" erreur={errors.notes?.message}><textarea rows={6} {...register('notes')} className={cls('notes')} placeholder="Horaires de livraison, conditions particulières…" /></FormField>
        </div>
      </form>
    </Modal>
  );
}
