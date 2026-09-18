import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TYPES_REGLEMENT } from '@quinca/shared-types';
import { LIBELLES_TYPE_REGLEMENT } from '../../../core/clients';
import { paiementPaieSchema, type PaiementPaieForm, type PaiementPaieFormInput } from '../../../core/employes';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCaisses } from '../clients/hooks';

/** Choix de la caisse et du mode pour payer une ou plusieurs paies. */
export default function PaiementModal({ filialeId, titre, sousTitre, onValider, onClose }: { filialeId: string; titre: string; sousTitre: string; onValider: (form: PaiementPaieForm) => Promise<void>; onClose: () => void }) {
  const caisses = useCaisses(filialeId);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PaiementPaieFormInput, unknown, PaiementPaieForm>({ resolver: zodResolver(paiementPaieSchema), defaultValues: { caisse_id: '', mode_paiement: 'ESPECES', reference: '' } });
  const cls = (c: keyof PaiementPaieFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  return (
    <Modal titre={titre} sousTitre={sousTitre} largeur="max-w-lg" onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="submit" form="paiement-paie-form" disabled={isSubmitting} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">Payer</button>
      </>
    }>
      <form id="paiement-paie-form" onSubmit={handleSubmit(onValider)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Caisse" obligatoire erreur={errors.caisse_id?.message}><select {...register('caisse_id')} className={cls('caisse_id')} autoFocus><option value="">— Choisir —</option>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></FormField>
          <FormField label="Mode" obligatoire erreur={errors.mode_paiement?.message}><select {...register('mode_paiement')} className={cls('mode_paiement')}>{TYPES_REGLEMENT.map((t) => <option key={t} value={t}>{LIBELLES_TYPE_REGLEMENT[t]}</option>)}</select></FormField>
        </div>
        <FormField label="Référence (virement, chèque…)" erreur={errors.reference?.message}><input {...register('reference')} className={cls('reference')} /></FormField>
      </form>
    </Modal>
  );
}

