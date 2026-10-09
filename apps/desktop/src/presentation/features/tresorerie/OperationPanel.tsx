import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownTrayIcon, ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import { LIBELLES_CATEGORIE, operationSchema, type Caisse, type OperationForm, type OperationFormInput } from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import AucuneCaisse from './AucuneCaisse';
import MouvementsRecents from './MouvementsRecents';
import RecuOperation, { type DonneesRecu } from './RecuOperation';
import SelectCaisse from './SelectCaisse';
import { useCaissesToutes } from './hooks';

export interface ConfigOperation {
  type: 'RECETTE' | 'DEPENSE';
  categories: readonly string[];
  /** Titre du reçu imprimé après l'enregistrement. */
  titreRecu: string;
  /** En-tête du cartouche du tiers : « Déposant », « Bénéficiaire »… */
  libelleTiers: string;
  signatureTiers: string;
  libelleBouton: string;
  titreHistorique: string;
  /** `data-testid` du champ montant, pour les tests de bout en bout. */
  prefixeTest: string;
}

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  config: ConfigOperation;
}

/**
 * Saisie d'une recette ou d'une dépense de caisse : sert aux sections
 * « Entrée en caisse » et « Dépense », qui ne diffèrent que par le sens, les
 * catégories proposées et les libellés du reçu.
 */
export default function OperationPanel({ filialeId, filiale, config }: Props) {
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  return (
    <div className="space-y-5">
      {caisses.length === 0 ? <AucuneCaisse /> : <Formulaire key={caisses[0]!.id} filialeId={filialeId} filiale={filiale} config={config} caisses={caisses} />}
      <MouvementsRecents filialeId={filialeId} categories={[...config.categories]} titre={config.titreHistorique} />
    </div>
  );
}

function Formulaire({ filialeId, filiale, config, caisses }: Props & { caisses: Caisse[] }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const [recu, setRecu] = useState<DonneesRecu | null>(null);
  const recette = config.type === 'RECETTE';

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<OperationFormInput, unknown, OperationForm>({
    resolver: zodResolver(operationSchema),
    defaultValues: { caisse_id: caisses[0]!.id, type: config.type, categorie: config.categories[0], montant: 0, tiers: '', description: '', reference: '' },
  });
  const cls = (c: keyof OperationFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const caisse = caisses.find((c) => c.id === watch('caisse_id'));

  const onSubmit = async (form: OperationForm) => {
    const description = [form.tiers, form.description].filter(Boolean).join(' — ');
    try {
      const code = await repository.enregistrerOperation({ filialeId, utilisateurId: utilisateur?.id ?? null }, { ...form, description });
      notifier('succes', `${recette ? 'Entrée' : 'Dépense'} ${code} de ${formaterFcfa(form.montant)} enregistrée.`);
      setRecu({
        titre: config.titreRecu,
        code,
        date: new Date().toISOString(),
        libelleTiers: config.libelleTiers,
        tiersNom: form.tiers || '—',
        tiersCompte: null,
        montant: form.montant,
        mode: 'ESPÈCES',
        designation: [LIBELLES_CATEGORIE[form.categorie] ?? form.categorie, form.description].filter(Boolean).join(' — '),
        observation: form.reference ? `Référence : ${form.reference}` : '',
        caisse: caisse?.nom ?? '',
        operateur: `${utilisateur?.prenom ?? ''} ${utilisateur?.nom ?? ''}`.trim() || '—',
        signatureTiers: config.signatureTiers,
      });
      reset({ caisse_id: form.caisse_id, type: config.type, categorie: form.categorie, montant: 0, tiers: '', description: '', reference: '' });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 space-y-4">
        <input type="hidden" {...register('type')} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectCaisse caisses={caisses} value={watch('caisse_id')} onChange={(id) => setValue('caisse_id', id)} erreur={errors.caisse_id?.message} />
          <FormField label="Catégorie" obligatoire erreur={errors.categorie?.message}>
            <select {...register('categorie')} className={cls('categorie')} data-testid={`${config.prefixeTest}-categorie`}>
              {config.categories.map((c) => <option key={c} value={c}>{LIBELLES_CATEGORIE[c] ?? c}</option>)}
            </select>
          </FormField>
          <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} data-testid={`${config.prefixeTest}-montant`} /></FormField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label={config.libelleTiers} erreur={errors.tiers?.message}><input {...register('tiers')} className={cls('tiers')} placeholder="Nom et prénom(s)" data-testid={`${config.prefixeTest}-tiers`} /></FormField>
          <FormField label="Description" erreur={errors.description?.message}><input {...register('description')} className={cls('description')} /></FormField>
          <FormField label="Référence (pièce justificative)" erreur={errors.reference?.message}><input {...register('reference')} className={cls('reference')} /></FormField>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-600">Solde de {caisse?.nom ?? '—'} : <strong className={`font-mono ${(caisse?.solde_actuel ?? 0) < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(caisse?.solde_actuel ?? 0)}</strong></p>
          <button type="submit" disabled={isSubmitting} className={`flex items-center gap-2 px-5 py-2.5 disabled:bg-neutral-300 text-white font-medium rounded-lg ${recette ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
            {recette ? <ArrowDownTrayIcon className="w-5 h-5" /> : <ArrowUpTrayIcon className="w-5 h-5" />} {config.libelleBouton}
          </button>
        </div>
      </form>

      {recu && <RecuOperation recu={recu} filiale={filiale} onClose={() => setRecu(null)} />}
    </>
  );
}
