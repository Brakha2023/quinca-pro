import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { TYPES_REGLEMENT } from '@quinca/shared-types';
import { LIBELLES_TYPE_REGLEMENT } from '../../../core/clients';
import { CATEGORIE_VERSEMENT, versementSchema, type Caisse, type VersementForm, type VersementFormInput } from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import Carte from '../../components/ui/Carte';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
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

/**
 * Versement encaissé au guichet : de l'argent qui entre en caisse, au nom de
 * celui qui l'apporte, avec son reçu.
 *
 * Il ne touche **aucun compte de tiers**. Régler une créance demande de voir
 * les factures du client et de lettrer le règlement : cela se fait dans
 * *Clients → Compte client*. Le faire aussi d'ici laissait deux chemins pour
 * une même somme, sans que rien ne les rapproche — et un client crédité deux
 * fois ne se découvre qu'à la relance.
 *
 * La liste du dessous, elle, montre les deux : ce qui est entré au guichet est
 * entré au guichet, quelle que soit la porte par laquelle il a été saisi.
 */
export default function VersementPanel({ filialeId, filiale }: Props) {
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  const { libelles } = useCategoriesTresorerie(filialeId);
  return (
    <div className="space-y-5">
      {caisses.length === 0 ? <AucuneCaisse /> : <Formulaire key={caisses[0]!.id} filialeId={filialeId} filiale={filiale} caisses={caisses} />}
      <OperationsSection
        filialeId={filialeId}
        filiale={filiale}
        codes={[CATEGORIE_VERSEMENT, 'REGLEMENT_CLIENT']}
        libelles={libelles}
        titre="Versements et règlements encaissés"
        baseExport="versements"
        prefixeTest="versements"
      />
    </div>
  );
}

/** Remonté dès que la première caisse est connue, pour que la caisse par défaut soit la bonne. */
function Formulaire({ filialeId, filiale, caisses }: Props & { caisses: Caisse[] }) {
  const tresorerie = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const [recu, setRecu] = useState<DonneesRecu | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<VersementFormInput, unknown, VersementForm>({
    resolver: zodResolver(versementSchema),
    defaultValues: { caisse_id: caisses[0]!.id, remettant: '', montant: 0, type_reglement: 'ESPECES', designation: '', observation: '', reference: '' },
  });
  const cls = (c: keyof VersementFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;

  const onSubmit = async (form: VersementForm) => {
    const caisse = caisses.find((c) => c.id === form.caisse_id);
    try {
      const code = await tresorerie.enregistrerVersement({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
      notifier('succes', `Versement ${code} de ${formaterFcfa(form.montant)} encaissé.`);
      setRecu({
        titre: 'Reçu de versement',
        code,
        date: new Date().toISOString(),
        libelleTiers: 'Informations remettant',
        tiersNom: form.remettant,
        tiersCompte: null,
        montant: form.montant,
        mode: LIBELLES_TYPE_REGLEMENT[form.type_reglement].toUpperCase(),
        designation: form.designation || 'Versement en caisse',
        observation: form.observation,
        caisse: caisse?.nom ?? '',
        operateur: `${utilisateur?.prenom ?? ''} ${utilisateur?.nom ?? ''}`.trim() || '—',
        signatureTiers: 'Signature du remettant',
      });
      reset({ caisse_id: form.caisse_id, remettant: '', montant: 0, type_reglement: form.type_reglement, designation: '', observation: '', reference: '' });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Encaissement impossible.');
    }
  };

  return (
    <>
      <Carte titre="Versement au guichet" icone={BanknotesIcon} sous="De l'argent qui entre en caisse, au nom de celui qui l'apporte">
        <form id="versement-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <SelectCaisse caisses={caisses} value={watch('caisse_id')} onChange={(id) => setValue('caisse_id', id)} erreur={errors.caisse_id?.message} />
            <FormField label="Nom du remettant" obligatoire erreur={errors.remettant?.message}>
              <input {...register('remettant')} className={cls('remettant')} placeholder="Nom et prénom(s)" data-testid="versement-remettant" />
            </FormField>
            <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} data-testid="versement-montant" /></FormField>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Mode" obligatoire erreur={errors.type_reglement?.message}><select {...register('type_reglement')} className={cls('type_reglement')}>{TYPES_REGLEMENT.map((t) => <option key={t} value={t}>{LIBELLES_TYPE_REGLEMENT[t]}</option>)}</select></FormField>
            <FormField label="Désignation" erreur={errors.designation?.message}><input {...register('designation')} className={cls('designation')} placeholder="Bon payé, avance…" /></FormField>
            <FormField label="Référence (bon, facture…)" erreur={errors.reference?.message}><input {...register('reference')} className={cls('reference')} /></FormField>
          </div>
          <FormField label="Observation" erreur={errors.observation?.message}><input {...register('observation')} className={cls('observation')} /></FormField>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Le guichet n'impute rien à un compte : on renvoie là où le compte se tient. */}
            <p className="text-sm text-neutral-500">
              Un client en compte règle sa créance dans{' '}
              <Link to="/clients/compte" className="text-primary-700 hover:underline font-medium">Clients → Compte client</Link>, où ses factures sont sous les yeux.
            </p>
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><BanknotesIcon className="w-5 h-5" /> Encaisser et imprimer le reçu</button>
          </div>
        </form>
      </Carte>

      {recu && <RecuOperation recu={recu} filiale={filiale} onClose={() => setRecu(null)} />}
    </>
  );
}
