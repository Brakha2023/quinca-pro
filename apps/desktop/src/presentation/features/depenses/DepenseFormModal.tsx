import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  depenseSchema, type Depense, type DepenseForm, type DepenseFormInput,
} from '../../../core/depenses';
import { categoriesSaisissables, type Caisse, type ChoixCategorie } from '../../../core/tresorerie';
import { DepensesRepository } from '../../../infrastructure/powersync/repositories/DepensesRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import ChampMontant from '../../components/ui/ChampMontant';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import AucuneCaisse from '../tresorerie/AucuneCaisse';
import { useCaissesToutes, useCategoriesTresorerie } from '../tresorerie/hooks';

interface Props {
  filialeId: string;
  /** Dépense à corriger ; absente, on engage une dépense neuve. */
  depense?: Depense | null;
  onClose: () => void;
}

/**
 * Saisie d'une dépense à approuver.
 *
 * Rien n'est payé en l'enregistrant : la dépense attend une décision, et la
 * caisse ne bouge qu'à la validation. L'écran le dit — c'est la différence
 * avec *Trésorerie → Dépense*, qui débite sur-le-champ.
 */
export default function DepenseFormModal({ filialeId, depense, onClose }: Props) {
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  const { categories } = useCategoriesTresorerie(filialeId);
  const choix = useMemo(() => categoriesSaisissables('DEPENSE', categories), [categories]);

  if (caisses.length === 0) {
    return (
      <Modal titre="Engager une dépense" largeur="max-w-md" onClose={onClose}>
        <AucuneCaisse message="Aucune caisse active : une dépense doit désigner la caisse qui la paiera. Créez-en une dans Trésorerie → Liste des caisses." />
      </Modal>
    );
  }

  /*
   * Remonté dès que les caisses et les catégories changent. Les deux viennent
   * de requêtes vivantes, qui reviennent **après** le premier rendu : un
   * formulaire né avant elles garderait des valeurs par défaut vides, et le
   * solde de la caisse ne s'afficherait jamais. Même parade que dans
   * `OperationPanel`.
   */
  return (
    <Saisie
      key={`${caisses[0]!.id}-${choix[0]?.code ?? ''}-${depense?.id ?? 'neuve'}`}
      filialeId={filialeId}
      depense={depense}
      onClose={onClose}
      caisses={caisses}
      choix={choix}
    />
  );
}

function Saisie({ filialeId, depense, onClose, caisses, choix }: Props & { caisses: Caisse[]; choix: ChoixCategorie[] }) {
  const repository = useRepository(DepensesRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<DepenseFormInput, unknown, DepenseForm>({
    resolver: zodResolver(depenseSchema),
    defaultValues: {
      caisse_id: depense?.caisse_id ?? caisses[0]?.id ?? '',
      categorie: depense?.categorie ?? choix[0]?.code ?? '',
      montant: depense?.montant ?? 0,
      beneficiaire: depense?.beneficiaire ?? '',
      description: depense?.description ?? '',
      reference: depense?.reference ?? '',
      date_depense: (depense?.date_depense ?? new Date().toISOString()).slice(0, 10),
    },
  });
  const cls = (champ: keyof DepenseFormInput) => `${inputClass} ${errors[champ] ? inputErrorClass : ''}`;
  const montant = Number(watch('montant')) || 0;
  const caisse = caisses.find((c) => c.id === watch('caisse_id'));

  const onSubmit = async (form: DepenseForm) => {
    try {
      if (depense) {
        await repository.modifier(depense.id, form);
        notifier('succes', `Dépense ${depense.numero} corrigée. Elle attend toujours son approbation.`);
      } else {
        await repository.enregistrer({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
        notifier('succes', `Dépense de ${formaterFcfa(form.montant)} engagée. Elle attend une approbation : rien n’est sorti de la caisse.`);
      }
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal
      titre={depense ? `Corriger la dépense ${depense.numero}` : 'Engager une dépense'}
      sousTitre="Elle attendra une approbation : la caisse ne bouge qu’à la validation."
      largeur="max-w-xl"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="depense-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" data-testid="enregistrer-depense">
            {depense ? 'Enregistrer la correction' : 'Engager la dépense'}
          </button>
        </>
      }
    >
      <form id="depense-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Montant" obligatoire erreur={errors.montant?.message}>
            {/* Les milliers se groupent pendant la frappe : un montant de caisse se relit. */}
            <ChampMontant
              valeur={montant}
              onChange={(v) => setValue('montant', v, { shouldValidate: true })}
              className={`${cls('montant')} text-right font-mono text-lg`}
              data-testid="depense-montant"
              aria-label="Montant"
            />
          </FormField>
          <FormField label="Date de la dépense" obligatoire erreur={errors.date_depense?.message}>
            {/* Une facture peut dater d'hier : la pièce porte son jour. */}
            <input type="date" {...register('date_depense')} className={cls('date_depense')} data-testid="depense-date" />
          </FormField>
          <FormField label="Caisse qui paiera" obligatoire erreur={errors.caisse_id?.message}>
            <select {...register('caisse_id')} className={cls('caisse_id')} data-testid="depense-caisse">
              {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
            </select>
          </FormField>
          <FormField label="Catégorie" obligatoire erreur={errors.categorie?.message}>
            <select {...register('categorie')} className={cls('categorie')} data-testid="depense-categorie">
              {choix.map((c) => <option key={c.code} value={c.code}>{c.libelle}</option>)}
            </select>
          </FormField>
          <FormField label="Bénéficiaire" obligatoire erreur={errors.beneficiaire?.message}>
            {/* La première question de qui approuve : à qui va l'argent. */}
            <input {...register('beneficiaire')} className={cls('beneficiaire')} placeholder="Nom, société, service…" data-testid="depense-beneficiaire" />
          </FormField>
          <FormField label="Pièce justificative" erreur={errors.reference?.message}>
            <input {...register('reference')} className={cls('reference')} placeholder="N° de facture, de reçu…" data-testid="depense-reference" />
          </FormField>
        </div>
        <FormField label="Motif" erreur={errors.description?.message}>
          <input {...register('description')} className={cls('description')} placeholder="Ce que la dépense paie" data-testid="depense-description" />
        </FormField>

        {caisse && (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
            Solde de <strong>{caisse.nom}</strong> : <span className="font-mono">{formaterFcfa(caisse.solde_actuel)}</span>
            {montant > 0 && (
              <>
                {' '}· après approbation : <span className={`font-mono font-semibold ${caisse.solde_actuel - montant < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(caisse.solde_actuel - montant)}</span>
                {/* Dit, pas interdit : un découvert de caisse se constate, et
                    c'est à celui qui approuve de décider. */}
                {caisse.solde_actuel - montant < 0 && <span className="ml-1 text-red-600">— la caisse passerait à découvert</span>}
              </>
            )}
          </p>
        )}
      </form>
    </Modal>
  );
}
