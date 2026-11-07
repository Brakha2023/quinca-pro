import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, PlusIcon } from '@heroicons/react/24/outline';
import {
  categoriesSaisissables, operationSchema,
  type Caisse, type CategorieTresorerie, type ChoixCategorie, type OperationForm, type OperationFormInput,
} from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import Carte from '../../components/ui/Carte';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { usePermissions } from '../../auth/usePermissions';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import AucuneCaisse from './AucuneCaisse';
import OperationsSection from './OperationsSection';
import RecuOperation, { type DonneesRecu } from './RecuOperation';
import SelectCaisse from './SelectCaisse';
import { CategoriesModal } from './modales';
import { useCaissesToutes, useCategoriesTresorerie } from './hooks';

export interface ConfigOperation {
  type: 'RECETTE' | 'DEPENSE';
  /** Titre du reçu imprimé après l'enregistrement. */
  titreRecu: string;
  /** En-tête du cartouche du tiers : « Déposant », « Bénéficiaire »… */
  libelleTiers: string;
  signatureTiers: string;
  libelleBouton: string;
  /** Bandeau de la carte de saisie : ce que l'écran fait, dit avant les champs. */
  titreSaisie: string;
  /** Ligne d'explication du bandeau de saisie. */
  sousSaisie: string;
  titreHistorique: string;
  /** Base du nom de fichier à l'export Excel de l'historique. */
  baseExport: string;
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
 *
 * Les catégories viennent pour partie du code (les intégrées) et pour partie
 * de la filiale, qui ajoute les siennes sans attendre une version de
 * l'application — voir `core/tresorerie/categories.ts`.
 */
export default function OperationPanel({ filialeId, filiale, config }: Props) {
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  const { categories, libelles } = useCategoriesTresorerie(filialeId);
  const choix = useMemo(() => categoriesSaisissables(config.type, categories), [config.type, categories]);

  return (
    <div className="space-y-5">
      {caisses.length === 0
        ? <AucuneCaisse />
        : <Formulaire key={caisses[0]!.id} filialeId={filialeId} filiale={filiale} config={config} caisses={caisses} choix={choix} categories={categories} />}
      <OperationsSection
        filialeId={filialeId}
        filiale={filiale}
        codes={choix.map((c) => c.code)}
        libelles={libelles}
        titre={config.titreHistorique}
        baseExport={config.baseExport}
        prefixeTest={config.prefixeTest}
      />
    </div>
  );
}

function Formulaire({ filialeId, filiale, config, caisses, choix, categories }: Props & { caisses: Caisse[]; choix: ChoixCategorie[]; categories: CategorieTresorerie[] }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { peut } = usePermissions();
  const { utilisateur } = useCurrentUtilisateur();
  const [recu, setRecu] = useState<DonneesRecu | null>(null);
  const [modaleCategories, setModaleCategories] = useState(false);
  /**
   * La catégorie que l'on vient de créer. Elle est tenue ici le temps que la
   * requête vivante la voie passer : sans cela, la sélectionner aussitôt la
   * désignerait avant qu'elle ne soit dans la liste, et le garde-fou
   * ci-dessous la remplacerait par la première proposée.
   */
  const [ajoutee, setAjoutee] = useState<ChoixCategorie | null>(null);
  const recette = config.type === 'RECETTE';

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<OperationFormInput, unknown, OperationForm>({
    resolver: zodResolver(operationSchema),
    defaultValues: { caisse_id: caisses[0]!.id, type: config.type, categorie: choix[0]?.code ?? '', montant: 0, tiers: '', description: '', reference: '' },
  });
  const cls = (c: keyof OperationFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const caisse = caisses.find((c) => c.id === watch('caisse_id'));
  const categorie = watch('categorie');
  const options = useMemo(
    () => (ajoutee && !choix.some((c) => c.code === ajoutee.code) ? [...choix, ajoutee] : choix),
    [choix, ajoutee],
  );
  const libelleCategorie = options.find((c) => c.code === categorie)?.libelle ?? categorie;

  // Une catégorie retirée de la liste pendant la saisie laisserait le champ sur
  // un code qui ne s'affiche plus : on retombe sur la première proposée.
  useEffect(() => {
    if (options.length > 0 && !options.some((c) => c.code === categorie)) setValue('categorie', options[0]!.code);
  }, [options, categorie, setValue]);

  // Désignée **après** le rendu qui l'ajoute à la liste : un `<select>` refuse
  // une valeur dont il n'a pas encore l'option, et le champ serait resté vide.
  useEffect(() => {
    if (ajoutee) setValue('categorie', ajoutee.code);
  }, [ajoutee, setValue]);

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
        designation: [libelleCategorie, form.description].filter(Boolean).join(' — '),
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
      <Carte titre={config.titreSaisie} icone={recette ? ArrowDownTrayIcon : ArrowUpTrayIcon} sous={config.sousSaisie}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <input type="hidden" {...register('type')} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectCaisse caisses={caisses} value={watch('caisse_id')} onChange={(id) => setValue('caisse_id', id)} erreur={errors.caisse_id?.message} />
            <FormField label="Catégorie" obligatoire erreur={errors.categorie?.message}>
              <div className="flex gap-2">
                <select {...register('categorie')} className={cls('categorie')} data-testid={`${config.prefixeTest}-categorie`}>
                  {options.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
                </select>
                {/* Qui saisit la dépense nomme sa catégorie : elle manque la pièce en main. */}
                {peut('tresorerie.mouvement') && (
                  <button type="button" onClick={() => setModaleCategories(true)} title="Ajouter ou renommer une catégorie" className="px-2.5 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg" data-testid={`${config.prefixeTest}-categories`}>
                    <PlusIcon className="w-5 h-5" />
                  </button>
                )}
              </div>
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
      </Carte>

      {modaleCategories && (
        <CategoriesModal
          filialeId={filialeId}
          type={config.type}
          categories={categories}
          onCreee={setAjoutee}
          onClose={() => setModaleCategories(false)}
        />
      )}
      {recu && <RecuOperation recu={recu} filiale={filiale} onClose={() => setRecu(null)} />}
    </>
  );
}
