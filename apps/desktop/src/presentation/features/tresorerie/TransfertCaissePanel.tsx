import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { transfertCaisseSchema, type Caisse, type TransfertCaisseForm, type TransfertCaisseFormInput } from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import AucuneCaisse from './AucuneCaisse';
import MouvementsRecents from './MouvementsRecents';
import SelectCaisse from './SelectCaisse';
import { useCaissesToutes } from './hooks';

interface Props {
  filialeId: string;
}

/** Transfert d'espèces entre deux caisses de la filiale : une sortie et une entrée, même référence. */
export default function TransfertCaissePanel({ filialeId }: Props) {
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  return (
    <div className="space-y-5">
      {caisses.length < 2
        ? <AucuneCaisse message="Un transfert inter-caisse demande au moins deux caisses actives dans la filiale." />
        : <Formulaire key={caisses[0]!.id} filialeId={filialeId} caisses={caisses} />}
      <MouvementsRecents filialeId={filialeId} categories={['TRANSFERT_CAISSE']} titre="Derniers transferts entre caisses" />
    </div>
  );
}

function Formulaire({ filialeId, caisses }: Props & { caisses: Caisse[] }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<TransfertCaisseFormInput, unknown, TransfertCaisseForm>({
    resolver: zodResolver(transfertCaisseSchema),
    defaultValues: { caisse_source_id: caisses[0]!.id, caisse_destination_id: caisses[1]!.id, montant: 0, motif: '' },
  });
  const source = caisses.find((c) => c.id === watch('caisse_source_id'));

  const onSubmit = async (form: TransfertCaisseForm) => {
    try {
      const numero = await repository.transferer({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
      notifier('succes', `Transfert ${numero} de ${formaterFcfa(form.montant)} effectué.`);
      reset({ caisse_source_id: form.caisse_source_id, caisse_destination_id: form.caisse_destination_id, montant: 0, motif: '' });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Transfert impossible.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <SelectCaisse caisses={caisses} value={watch('caisse_source_id')} onChange={(id) => setValue('caisse_source_id', id)} label="Depuis" erreur={errors.caisse_source_id?.message} testId="transfert-source" />
        <SelectCaisse caisses={caisses} value={watch('caisse_destination_id')} onChange={(id) => setValue('caisse_destination_id', id)} label="Vers" erreur={errors.caisse_destination_id?.message} testId="transfert-destination" />
        <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${inputClass} ${errors.montant ? inputErrorClass : ''} text-right font-mono text-lg`} data-testid="transfert-montant" /></FormField>
      </div>
      <FormField label="Motif" erreur={errors.motif?.message}><input {...register('motif')} className={inputClass} placeholder="Alimentation du coffre, appoint…" /></FormField>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">Solde de {source?.nom ?? '—'} : <strong className={`font-mono ${(source?.solde_actuel ?? 0) < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(source?.solde_actuel ?? 0)}</strong></p>
        <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><ArrowsRightLeftIcon className="w-5 h-5" /> Transférer</button>
      </div>
    </form>
  );
}
