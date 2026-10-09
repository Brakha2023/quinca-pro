import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BanknotesIcon } from '@heroicons/react/24/outline';
import { TYPES_REGLEMENT } from '@quinca/shared-types';
import { LIBELLES_TYPE_REGLEMENT } from '../../../core/clients';
import { CATEGORIE_VERSEMENT, versementSchema, type Caisse, type VersementForm, type VersementFormInput } from '../../../core/tresorerie';
import { ClientsRepository } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useClients } from '../clients/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import AucuneCaisse from './AucuneCaisse';
import MouvementsRecents from './MouvementsRecents';
import RecuOperation, { type DonneesRecu } from './RecuOperation';
import SelectCaisse from './SelectCaisse';
import { useCaissesToutes } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/**
 * Versement encaissé au guichet. Si le remettant est un client en compte, le
 * versement passe par son compte (créance mise à jour) ; sinon c'est une
 * simple recette de caisse. Dans les deux cas, le reçu s'imprime aussitôt.
 */
export default function VersementPanel({ filialeId, filiale }: Props) {
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  return (
    <div className="space-y-5">
      {caisses.length === 0 ? <AucuneCaisse /> : <Formulaire key={caisses[0]!.id} filialeId={filialeId} filiale={filiale} caisses={caisses} />}
      <MouvementsRecents filialeId={filialeId} categories={[CATEGORIE_VERSEMENT, 'REGLEMENT_CLIENT']} titre="Derniers versements" />
    </div>
  );
}

/** Remonté dès que la première caisse est connue, pour que la caisse par défaut soit la bonne. */
function Formulaire({ filialeId, filiale, caisses }: Props & { caisses: Caisse[] }) {
  const tresorerie = useRepository(TresorerieRepository);
  const clientsRepo = useRepository(ClientsRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { clients } = useClients(filialeId);
  const [recu, setRecu] = useState<DonneesRecu | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<VersementFormInput, unknown, VersementForm>({
    resolver: zodResolver(versementSchema),
    defaultValues: { caisse_id: caisses[0]!.id, client_id: '', remettant: '', montant: 0, type_reglement: 'ESPECES', designation: '', observation: '', reference: '' },
  });
  const cls = (c: keyof VersementFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const clientId = watch('client_id');
  const client = clients.find((c) => c.id === clientId);

  const onSubmit = async (form: VersementForm) => {
    const ctx = { filialeId, utilisateurId: utilisateur?.id ?? null };
    const caisse = caisses.find((c) => c.id === form.caisse_id);
    try {
      const code = form.client_id
        ? await clientsRepo.enregistrerReglement(ctx, form.client_id, {
            montant: form.montant, type_reglement: form.type_reglement, caisse_id: form.caisse_id, reference: form.reference, date_reglement: '',
          })
        : await tresorerie.enregistrerVersement(ctx, form);
      notifier('succes', `Versement ${code} de ${formaterFcfa(form.montant)} encaissé.`);
      setRecu({
        titre: 'Reçu de versement',
        code,
        date: new Date().toISOString(),
        libelleTiers: form.client_id ? 'Informations client' : 'Informations remettant',
        tiersNom: form.remettant || client?.raison_sociale || '',
        tiersCompte: client?.numero_compte || client?.code || null,
        montant: form.montant,
        mode: LIBELLES_TYPE_REGLEMENT[form.type_reglement].toUpperCase(),
        designation: form.designation || (form.client_id ? 'Versement sur compte client' : 'Versement en caisse'),
        observation: form.observation,
        caisse: caisse?.nom ?? '',
        operateur: `${utilisateur?.prenom ?? ''} ${utilisateur?.nom ?? ''}`.trim() || '—',
        signatureTiers: 'Signature du client (ou remettant)',
      });
      reset({ caisse_id: form.caisse_id, client_id: '', remettant: '', montant: 0, type_reglement: form.type_reglement, designation: '', observation: '', reference: '' });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Encaissement impossible.');
    }
  };

  return (
    <>
      <form id="versement-form" onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border border-neutral-200 shadow-sm p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectCaisse caisses={caisses} value={watch('caisse_id')} onChange={(id) => setValue('caisse_id', id)} erreur={errors.caisse_id?.message} />
          <FormField label="Client en compte" erreur={errors.client_id?.message}>
            <select {...register('client_id')} className={cls('client_id')} data-testid="versement-client">
              <option value="">— Remettant hors compte —</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.code} · {c.raison_sociale}{c.solde_actuel > 0 ? ` (doit ${formaterFcfa(c.solde_actuel)})` : ''}</option>)}
            </select>
          </FormField>
          <FormField label={clientId ? 'Remettant (si différent)' : 'Nom du remettant'} obligatoire={!clientId} erreur={errors.remettant?.message}>
            <input {...register('remettant')} className={cls('remettant')} placeholder="Nom et prénom(s)" data-testid="versement-remettant" />
          </FormField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono text-lg`} data-testid="versement-montant" /></FormField>
          <FormField label="Mode" obligatoire erreur={errors.type_reglement?.message}><select {...register('type_reglement')} className={cls('type_reglement')}>{TYPES_REGLEMENT.map((t) => <option key={t} value={t}>{LIBELLES_TYPE_REGLEMENT[t]}</option>)}</select></FormField>
          <FormField label="Référence (bon, facture…)" erreur={errors.reference?.message}><input {...register('reference')} className={cls('reference')} /></FormField>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Désignation" erreur={errors.designation?.message}><input {...register('designation')} className={cls('designation')} placeholder="Bon payé, avance…" /></FormField>
          <FormField label="Observation" erreur={errors.observation?.message}><input {...register('observation')} className={cls('observation')} /></FormField>
        </div>
        {client && (
          <p className="text-sm text-neutral-600">Compte {client.code} · {client.solde_actuel > 0 ? <>doit <strong className="font-mono text-red-600">{formaterFcfa(client.solde_actuel)}</strong></> : <>avoir <strong className="font-mono text-green-700">{formaterFcfa(-client.solde_actuel)}</strong></>}. Le versement sera imputé sur son compte.</p>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><BanknotesIcon className="w-5 h-5" /> Encaisser et imprimer le reçu</button>
        </div>
      </form>

      {recu && <RecuOperation recu={recu} filiale={filiale} onClose={() => setRecu(null)} />}
    </>
  );
}
