import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { CATEGORIE_RETRAIT, retraitSchema, type Caisse, type RetraitForm, type RetraitFormInput } from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import Carte from '../../components/ui/Carte';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import AucuneCaisse from './AucuneCaisse';
import OperationsSection from './OperationsSection';
import RecuOperation, { type DonneesRecu } from './RecuOperation';
import SelectCaisse from './SelectCaisse';
import { useCaissesToutes, useCategoriesTresorerie } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/** Retrait d'espèces : sortie de caisse remise à un bénéficiaire, avec reçu signé. */
export default function RetraitPanel({ filialeId, filiale }: Props) {
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  const { libelles } = useCategoriesTresorerie(filialeId);
  return (
    <div className="space-y-5">
      {caisses.length === 0 ? <AucuneCaisse /> : <Formulaire key={caisses[0]!.id} filialeId={filialeId} filiale={filiale} caisses={caisses} />}
      <OperationsSection filialeId={filialeId} filiale={filiale} codes={[CATEGORIE_RETRAIT]} libelles={libelles} titre="Retraits d'espèces" baseExport="retraits" prefixeTest="retraits" />
    </div>
  );
}

function Formulaire({ filialeId, filiale, caisses }: Props & { caisses: Caisse[] }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();
  const [recu, setRecu] = useState<DonneesRecu | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<RetraitFormInput, unknown, RetraitForm>({
    resolver: zodResolver(retraitSchema),
    defaultValues: { caisse_id: caisses[0]!.id, beneficiaire: '', montant: 0, motif: '', reference: '' },
  });
  const cls = (c: keyof RetraitFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const caisse = caisses.find((c) => c.id === watch('caisse_id'));

  const onSubmit = async (form: RetraitForm) => {
    const solde = caisse?.solde_actuel ?? 0;
    if (form.montant > solde) {
      const ok = await confirmer({
        titre: 'Retrait supérieur au solde',
        message: `La caisse ${caisse?.nom ?? ''} affiche ${formaterFcfa(solde)} et le retrait est de ${formaterFcfa(form.montant)}. Elle passera en négatif.`,
        libelleConfirmer: 'Retirer quand même',
        danger: true,
      });
      if (!ok) return;
    }
    try {
      const code = await repository.enregistrerRetrait({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
      notifier('succes', `Retrait ${code} de ${formaterFcfa(form.montant)} enregistré.`);
      setRecu({
        titre: 'Reçu de retrait',
        code,
        date: new Date().toISOString(),
        libelleTiers: 'Bénéficiaire',
        tiersNom: form.beneficiaire,
        tiersCompte: null,
        montant: form.montant,
        mode: 'ESPÈCES',
        designation: form.motif || 'Retrait d’espèces',
        observation: '',
        caisse: caisse?.nom ?? '',
        operateur: `${utilisateur?.prenom ?? ''} ${utilisateur?.nom ?? ''}`.trim() || '—',
        signatureTiers: 'Signature du bénéficiaire',
      });
      reset({ caisse_id: form.caisse_id, beneficiaire: '', montant: 0, motif: '', reference: '' });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Retrait impossible.');
    }
  };

  return (
    <>
      <Carte titre="Retrait d'espèces" icone={ArrowUpTrayIcon} sous="Sortie de caisse remise à un bénéficiaire, contre reçu signé">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectCaisse caisses={caisses} value={watch('caisse_id')} onChange={(id) => setValue('caisse_id', id)} erreur={errors.caisse_id?.message} />
            <FormField label="Bénéficiaire" obligatoire erreur={errors.beneficiaire?.message}><input {...register('beneficiaire')} className={cls('beneficiaire')} placeholder="Nom et prénom(s)" data-testid="retrait-beneficiaire" /></FormField>
            <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} data-testid="retrait-montant" /></FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Motif" erreur={errors.motif?.message}><input {...register('motif')} className={cls('motif')} placeholder="Dépôt en banque, remise au gérant…" /></FormField>
            <FormField label="Référence" erreur={errors.reference?.message}><input {...register('reference')} className={cls('reference')} /></FormField>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">Solde de {caisse?.nom ?? '—'} : <strong className={`font-mono ${(caisse?.solde_actuel ?? 0) < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(caisse?.solde_actuel ?? 0)}</strong></p>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><ArrowUpTrayIcon className="w-5 h-5" /> Retirer et imprimer le reçu</button>
          </div>
        </form>
      </Carte>

      {recu && <RecuOperation recu={recu} filiale={filiale} onClose={() => setRecu(null)} />}
    </>
  );
}
