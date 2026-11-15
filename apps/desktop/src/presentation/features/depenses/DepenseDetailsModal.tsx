import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUturnLeftIcon, NoSymbolIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import type { StatutDepense } from '@quinca/shared-types';
import {
  LIBELLES_STATUT_DEPENSE, depenseModifiable, depenseRefusable, depenseRouvrable,
  refusSchema, type RefusForm,
} from '../../../core/depenses';
import { DepensesRepository } from '../../../infrastructure/powersync/repositories/DepensesRepository';
import Modal from '../../components/ui/Modal';
import Bouton from '../../components/ui/Bouton';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useAuth } from '../../auth/useAuth';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import DepenseFormModal from './DepenseFormModal';
import type { DepenseVue } from './hooks';

export const STATUT_DEPENSE_STYLE: Record<StatutDepense, string> = {
  EN_ATTENTE: 'bg-orange-100 text-orange-700',
  VALIDEE: 'bg-green-100 text-green-700',
  REFUSEE: 'bg-red-100 text-red-700',
};

export function formaterDateHeure(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  depense: DepenseVue;
  filialeId: string;
  /** Porte les actes de décision : approuver, refuser, rouvrir (`depenses.valider`). */
  peutValider: boolean;
  /** Porte la saisie et la correction d'une dépense en attente (`tresorerie.mouvement`). */
  peutSaisir: boolean;
  onClose: () => void;
}

/**
 * Détail d'une dépense, et les actes que son statut autorise : la corriger ou
 * la refuser tant qu'elle attend, la remettre en attente si elle est payée.
 *
 * L'approbation se fait depuis la liste, par lot : c'est le geste de celui qui
 * passe en revue ce qui attend.
 */
export default function DepenseDetailsModal({ depense, filialeId, peutValider, peutSaisir, onClose }: Props) {
  const repository = useRepository(DepensesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateurId } = useAuth();
  const [correction, setCorrection] = useState(false);
  const [refus, setRefus] = useState(false);
  const ctx = { filialeId, utilisateurId };

  const remettreEnAttente = async () => {
    if (!(await confirmer({
      titre: `Remettre la dépense ${depense.numero} en attente`,
      message: `L’approbation sera défaite : la dépense pourra de nouveau être corrigée ou refusée, et ${formaterFcfa(depense.montant)} rentreront dans la caisse ${depense.caisse_nom ?? ''}. La reprise se lira au journal de caisse.`,
      libelleConfirmer: 'Remettre en attente',
    }))) return;
    try {
      await repository.remettreEnAttente(ctx, depense.id);
      notifier('succes', `Dépense ${depense.numero} remise en attente, ${formaterFcfa(depense.montant)} repris en caisse.`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Remise en attente impossible.');
    }
  };

  return (
    <Modal
      titre={`Dépense ${depense.numero}`}
      sousTitre={`${formaterDateHeure(depense.date_depense)} · ${depense.caisse_nom ?? ''}${depense.auteur ? ` · engagée par ${depense.auteur}` : ''}`}
      largeur="max-w-2xl"
      onClose={onClose}
      pied={
        <>
          {peutValider && depenseRefusable(depense.statut) && (
            <button type="button" onClick={() => setRefus(true)} className="mr-auto flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg" data-testid="refuser-depense">
              <NoSymbolIcon className="w-4 h-4" /> Refuser
            </button>
          )}
          {/*
            Le seul acte offert sur une dépense payée : lui rendre son droit
            d'être corrigée. Il prend la place du bouton « Refuser », à gauche,
            parce qu'il ouvre la même porte.
          */}
          {peutValider && depenseRouvrable(depense.statut) && (
            <Bouton onClick={remettreEnAttente} icone={ArrowUturnLeftIcon} tailleIcone="w-4 h-4" className="mr-auto flex items-center gap-2 px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 font-medium rounded-lg" data-testid="remettre-depense-en-attente">
              Remettre en attente
            </Bouton>
          )}
          {peutSaisir && depenseModifiable(depense.statut) && (
            <button type="button" onClick={() => setCorrection(true)} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg" data-testid="corriger-depense">
              <PencilSquareIcon className="w-4 h-4" /> Corriger
            </button>
          )}
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Fermer</button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_DEPENSE_STYLE[depense.statut]}`}>{LIBELLES_STATUT_DEPENSE[depense.statut]}</span>
          <span>Bénéficiaire : <strong>{depense.beneficiaire ?? '—'}</strong></span>
          {depense.reference && <span>Pièce : <strong>{depense.reference}</strong></span>}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Montant</p><p className="font-mono font-bold text-primary-700">{formaterFcfa(depense.montant)}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Caisse</p><p>{depense.caisse_nom ?? '—'}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Catégorie</p><p>{depense.categorie}</p></div>
        </div>

        {depense.description && <p className="text-sm text-neutral-700">{depense.description}</p>}

        {/* Une autorisation sans nom n'en est pas une : qui a décidé, et quand. */}
        {depense.statut !== 'EN_ATTENTE' && (
          <p className="rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-600" data-testid="decision-depense">
            {depense.statut === 'VALIDEE' ? 'Approuvée' : 'Refusée'}
            {depense.approbateur ? ` par ${depense.approbateur}` : ''}
            {depense.date_validation ? ` le ${formaterDateHeure(depense.date_validation)}` : ''}
            {depense.motif_refus ? ` — ${depense.motif_refus}` : ''}
          </p>
        )}
      </div>

      {correction && (
        <DepenseFormModal filialeId={filialeId} depense={depense} onClose={() => { setCorrection(false); onClose(); }} />
      )}
      {refus && <RefusModal depense={depense} ctx={ctx} onClose={() => setRefus(false)} onRefusee={onClose} />}
    </Modal>
  );
}

/** Un refus se motive : sans raison, la même demande revient le lendemain. */
function RefusModal({ depense, ctx, onClose, onRefusee }: {
  depense: DepenseVue;
  ctx: { filialeId: string; utilisateurId: string | null };
  onClose: () => void;
  onRefusee: () => void;
}) {
  const repository = useRepository(DepensesRepository);
  const notifier = useNotifier();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RefusForm>({ resolver: zodResolver(refusSchema) });

  const onSubmit = async (form: RefusForm) => {
    try {
      await repository.refuser(ctx, depense.id, form.motif);
      notifier('succes', `Dépense ${depense.numero} refusée. Rien n’est sorti de la caisse.`);
      onRefusee();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Refus impossible.');
    }
  };

  return (
    <Modal
      titre={`Refuser la dépense ${depense.numero}`}
      sousTitre={`${formaterFcfa(depense.montant)} — ${depense.beneficiaire ?? ''}`}
      largeur="max-w-md"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button type="submit" form="refus-form" disabled={isSubmitting} className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" data-testid="confirmer-refus">Refuser</button>
        </>
      }
    >
      <form id="refus-form" onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <FormField label="Motif du refus" obligatoire erreur={errors.motif?.message}>
          <input {...register('motif')} className={`${inputClass} ${errors.motif ? inputErrorClass : ''}`} placeholder="Pourquoi la dépense est refusée" autoFocus data-testid="motif-refus" />
        </FormField>
        <p className="text-xs text-neutral-500">
          La pièce reste au dossier avec son motif : rien n’est effacé, et la même demande ne reviendra pas telle quelle.
        </p>
      </form>
    </Modal>
  );
}
