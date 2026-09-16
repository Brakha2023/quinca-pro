import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TYPES_REGLEMENT } from '@quinca/shared-types';
import { LIBELLES_TYPE_REGLEMENT } from '../../../core/clients';
import { reglementFournisseurSchema, type Fournisseur, type ReglementFournisseurForm, type ReglementFournisseurFormInput } from '../../../core/fournisseurs';
import { FournisseursRepository } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa, formaterDate } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useCaisses } from '../clients/hooks';
import { useAchatsFournisseur } from './hooks';

/** Paiement d'un fournisseur depuis une caisse (dépense de trésorerie). */
export default function ReglementFournisseurModal({ filialeId, fournisseur, onClose }: { filialeId: string; fournisseur: Fournisseur; onClose: () => void }) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const caisses = useCaisses(filialeId);
  const achats = useAchatsFournisseur(fournisseur.id).filter((a) => a.reste_a_payer > 0);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ReglementFournisseurFormInput, unknown, ReglementFournisseurForm>({
    resolver: zodResolver(reglementFournisseurSchema),
    defaultValues: { montant: Math.max(fournisseur.solde_actuel, 0) || 0, type_reglement: 'ESPECES', caisse_id: '', reference: '', commande_id: '' },
  });
  const montant = Number(watch('montant')) || 0;
  const caisseId = watch('caisse_id');
  const caisse = caisses.find((c) => c.id === caisseId);
  const cls = (c: keyof ReglementFournisseurFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;

  const onSubmit = async (form: ReglementFournisseurForm) => {
    try {
      const numero = await repository.enregistrerReglement({ filialeId, utilisateurId: utilisateur?.id ?? null }, fournisseur.id, form);
      notifier('succes', `Règlement ${numero} de ${formaterFcfa(form.montant)} enregistré.`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal titre={`Payer — ${fournisseur.raison_sociale}`} sousTitre={`Dette actuelle : ${formaterFcfa(fournisseur.solde_actuel)}`} largeur="max-w-lg" onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="submit" form="rgf-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">Payer</button>
      </>
    }>
      <form id="rgf-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} autoFocus /></FormField>
          <FormField label="Mode" obligatoire erreur={errors.type_reglement?.message}>
            <select {...register('type_reglement')} className={cls('type_reglement')}>{TYPES_REGLEMENT.map((t) => <option key={t} value={t}>{LIBELLES_TYPE_REGLEMENT[t]}</option>)}</select>
          </FormField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Caisse" obligatoire erreur={errors.caisse_id?.message}>
            <select {...register('caisse_id')} className={cls('caisse_id')}><option value="">— Choisir —</option>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom} ({formaterFcfa(c.solde_actuel)})</option>)}</select>
          </FormField>
          <FormField label="Achat concerné (optionnel)">
            <select {...register('commande_id')} className={inputClass}><option value="">— Acompte / global —</option>{achats.map((a) => <option key={a.id} value={a.id}>{a.numero} · reste {formaterFcfa(a.reste_a_payer)} · {formaterDate(a.date_commande)}</option>)}</select>
          </FormField>
        </div>
        <FormField label="Référence (n° chèque, virement…)"><input {...register('reference')} className={inputClass} /></FormField>
        {caisse && (caisse.solde_actuel ?? 0) < montant && <p className="text-sm text-orange-700">Attention : le solde de la caisse ({formaterFcfa(caisse.solde_actuel)}) est inférieur au montant.</p>}
        <p className="text-sm text-neutral-600">Dette après paiement : <span className="font-mono font-semibold">{formaterFcfa(fournisseur.solde_actuel - montant)}</span></p>
      </form>
    </Modal>
  );
}
