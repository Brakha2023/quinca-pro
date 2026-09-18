import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowPathIcon, BanknotesIcon, PencilSquareIcon, PlusIcon } from '@heroicons/react/24/outline';
import { LIBELLES_STATUT_PAIE, LIBELLES_TYPE_CONTRAT, avanceSalaireSchema, libellePeriode, nomComplet, periodeCourante, type AvanceSalaireForm, type AvanceSalaireFormInput } from '../../../core/employes';
import { EmployesRepository } from '../../../infrastructure/powersync/repositories/EmployesRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useCaisses } from '../clients/hooks';
import { useAvances, useEmployes, usePaies, type PaieVue } from './hooks';
import PaiementModal from './PaiementModal';
import SelectPeriode from './SelectPeriode';

interface Props {
  filialeId: string;
}

function AvanceModal({ filialeId, periode, onClose }: { filialeId: string; periode: string; onClose: () => void }) {
  const repository = useRepository(EmployesRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { employes } = useEmployes(filialeId);
  const caisses = useCaisses(filialeId);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<AvanceSalaireFormInput, unknown, AvanceSalaireForm>({ resolver: zodResolver(avanceSalaireSchema), defaultValues: { employe_id: '', periode, montant: 0, caisse_id: '', notes: '' } });
  const cls = (c: keyof AvanceSalaireFormInput) => `${inputClass} ${errors[c] ? inputErrorClass : ''}`;
  const onSubmit = async (form: AvanceSalaireForm) => {
    try { const n = await repository.enregistrerAvance({ filialeId, utilisateurId: utilisateur?.id ?? null }, form); notifier('succes', `Avance ${n} de ${formaterFcfa(form.montant)} versée, retenue sur la paie de ${libellePeriode(form.periode)}.`); onClose(); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.'); }
  };
  return (
    <Modal titre="Avance sur salaire" sousTitre="Sortie de caisse immédiate, retenue sur la paie du mois choisi" largeur="max-w-lg" onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="submit" form="avance-form" disabled={isSubmitting} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">Verser l'avance</button>
      </>
    }>
      <form id="avance-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField label="Employé" obligatoire erreur={errors.employe_id?.message}><select {...register('employe_id')} className={cls('employe_id')}><option value="">— Choisir —</option>{employes.map((e) => <option key={e.id} value={e.id}>{e.matricule} · {nomComplet(e)}</option>)}</select></FormField>
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${cls('montant')} text-right font-mono`} autoFocus /></FormField>
          <FormField label="Mois de paie" obligatoire erreur={errors.periode?.message}><input type="month" {...register('periode')} className={cls('periode')} /></FormField>
        </div>
        <FormField label="Caisse" obligatoire erreur={errors.caisse_id?.message}><select {...register('caisse_id')} className={cls('caisse_id')}><option value="">— Choisir —</option>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select></FormField>
        <FormField label="Notes" erreur={errors.notes?.message}><input {...register('notes')} className={cls('notes')} /></FormField>
      </form>
    </Modal>
  );
}

function AjustementModal({ paie, onClose }: { paie: PaieVue; onClose: () => void }) {
  const repository = useRepository(EmployesRepository);
  const notifier = useNotifier();
  const [primes, setPrimes] = useState(paie.primes);
  const [retenues, setRetenues] = useState(paie.retenues);
  const [notes, setNotes] = useState(paie.notes ?? '');
  const valider = async () => {
    try { await repository.ajusterPaie(paie.id, { primes, retenues, notes }); notifier('succes', `Paie de ${nomComplet(paie)} ajustée.`); onClose(); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Ajustement impossible.'); }
  };
  return (
    <Modal titre={`Ajuster — ${nomComplet(paie)}`} sousTitre={`${libellePeriode(paie.periode)} · brut ${formaterFcfa(paie.brut)} · avances ${formaterFcfa(paie.avances)}`} largeur="max-w-lg" onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="button" onClick={valider} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Enregistrer</button>
      </>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Primes"><input type="number" step="1" min="0" value={primes} onChange={(e) => setPrimes(Number(e.target.value))} className={`${inputClass} text-right font-mono`} autoFocus /></FormField>
          <FormField label="Retenues (hors absences et avances)"><input type="number" step="1" min="0" value={retenues} onChange={(e) => setRetenues(Number(e.target.value))} className={`${inputClass} text-right font-mono`} /></FormField>
        </div>
        <FormField label="Notes"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} /></FormField>
        <p className="text-sm text-neutral-600">Net estimé : <strong className="font-mono">{formaterFcfa(Math.max(paie.brut + primes - retenues - paie.avances, 0))}</strong></p>
      </div>
    </Modal>
  );
}

/** Paie du mois : génération depuis les pointages, avances, primes/retenues, paiement individuel ou groupé. */
export default function PaiePanel({ filialeId }: Props) {
  const repository = useRepository(EmployesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();
  const ctx = { filialeId, utilisateurId: utilisateur?.id ?? null };
  const [periode, setPeriode] = useState(periodeCourante);
  const [modal, setModal] = useState<{ type: 'avance' } | { type: 'ajuster'; p: PaieVue } | { type: 'payer'; p: PaieVue } | { type: 'payerTout' } | null>(null);
  const { paies, isLoading } = usePaies(filialeId, periode);
  const avances = useAvances(filialeId, periode);
  const totaux = paies.reduce((t, p) => ({ brut: t.brut + p.brut, net: t.net + p.net_a_payer, aPayer: t.aPayer + (p.statut === 'CALCULEE' ? p.net_a_payer : 0), payees: t.payees + (p.statut === 'PAYEE' ? 1 : 0) }), { brut: 0, net: 0, aPayer: 0, payees: 0 });

  const generer = async () => {
    try { const r = await repository.genererPaies(ctx, periode); notifier('succes', `Paie de ${libellePeriode(periode)} : ${r.creees} créée(s), ${r.misesAJour} recalculée(s).`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Génération impossible.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <SelectPeriode value={periode} onChange={setPeriode} />
        <button type="button" onClick={generer} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"><ArrowPathIcon className="w-5 h-5" /> {paies.length === 0 ? 'Générer la paie du mois' : 'Recalculer depuis les pointages'}</button>
        <button type="button" onClick={() => setModal({ type: 'avance' })} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Avance sur salaire</button>
        {totaux.aPayer > 0 && <button type="button" onClick={() => setModal({ type: 'payerTout' })} className="ml-auto flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"><BanknotesIcon className="w-5 h-5" /> Payer tout ({formaterFcfa(totaux.aPayer)})</button>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Brut du mois</p><p className="text-xl font-bold font-mono mt-1">{formaterFcfa(totaux.brut)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Avances versées</p><p className="text-xl font-bold font-mono text-orange-700 mt-1">{formaterFcfa(avances.reduce((s, a) => s + (a.montant ?? 0), 0))}</p><p className="text-xs text-neutral-500">{avances.length} avance(s)</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Net à payer</p><p className="text-xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(totaux.aPayer)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Paies payées</p><p className="text-xl font-bold mt-1">{totaux.payees} / {paies.length}</p></div>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-3 text-left">Employé</th><th className="px-3 py-3 text-left">Contrat</th><th className="px-3 py-3 text-right">Base</th><th className="px-3 py-3 text-right">Prés.</th><th className="px-3 py-3 text-right">Abs.</th><th className="px-3 py-3 text-right">Ret. absences</th><th className="px-3 py-3 text-right">Brut</th><th className="px-3 py-3 text-right">Primes</th><th className="px-3 py-3 text-right">Retenues</th><th className="px-3 py-3 text-right">Avances</th><th className="px-3 py-3 text-right">Net à payer</th><th className="px-3 py-3 text-center">Statut</th><th className="px-3 py-3 text-center">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {paies.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50" data-testid={`paie-${p.matricule}`}>
                <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{p.matricule}</span>{nomComplet(p)}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{LIBELLES_TYPE_CONTRAT[p.type_contrat as keyof typeof LIBELLES_TYPE_CONTRAT] ?? p.type_contrat}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(p.salaire_base)}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{p.jours_presents}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-red-600">{p.jours_absents}{p.jours_justifies ? <span className="text-orange-700"> (+{p.jours_justifies} j.)</span> : ''}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-red-600">{p.retenue_absences ? `−${formaterFcfa(p.retenue_absences)}` : '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(p.brut)}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{p.primes ? `+${formaterFcfa(p.primes)}` : '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-red-600">{p.retenues ? `−${formaterFcfa(p.retenues)}` : '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-orange-700">{p.avances ? `−${formaterFcfa(p.avances)}` : '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-bold">{formaterFcfa(p.net_a_payer)}</td>
                <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.statut === 'PAYEE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{LIBELLES_STATUT_PAIE[p.statut]}{p.statut === 'PAYEE' && p.date_paiement ? ` · ${formaterDate(p.date_paiement)}` : ''}</span></td>
                <td className="px-3 py-2 text-center">
                  {p.statut === 'CALCULEE' && (
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setModal({ type: 'ajuster', p })} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700" title="Primes / retenues"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => setModal({ type: 'payer', p })} className="p-1.5 rounded hover:bg-green-50 text-green-700" title="Payer"><BanknotesIcon className="w-4 h-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          {paies.length > 0 && <tfoot className="bg-neutral-50 border-t border-neutral-200 text-sm font-semibold"><tr><td colSpan={6} className="px-3 py-2 text-right">Totaux</td><td className="px-3 py-2 text-right font-mono">{formaterFcfa(totaux.brut)}</td><td colSpan={3} /><td className="px-3 py-2 text-right font-mono">{formaterFcfa(totaux.net)}</td><td colSpan={2} /></tr></tfoot>}
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && paies.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune paie pour {libellePeriode(periode)} : générez-la depuis les pointages.</div>}
      </div>

      {modal?.type === 'avance' && <AvanceModal filialeId={filialeId} periode={periode} onClose={() => setModal(null)} />}
      {modal?.type === 'ajuster' && <AjustementModal paie={modal.p} onClose={() => setModal(null)} />}
      {modal?.type === 'payer' && (
        <PaiementModal filialeId={filialeId} titre={`Payer ${nomComplet(modal.p)}`} sousTitre={`${libellePeriode(periode)} · net ${formaterFcfa(modal.p.net_a_payer)}`} onClose={() => setModal(null)}
          onValider={async (form) => { try { await repository.payer(ctx, modal.p.id, form); notifier('succes', `Salaire de ${nomComplet(modal.p)} payé.`); setModal(null); } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Paiement impossible.'); } }} />
      )}
      {modal?.type === 'payerTout' && (
        <PaiementModal filialeId={filialeId} titre="Payer toutes les paies" sousTitre={`${libellePeriode(periode)} · ${formaterFcfa(totaux.aPayer)} pour ${paies.filter((p) => p.statut === 'CALCULEE').length} employé(s)`} onClose={() => setModal(null)}
          onValider={async (form) => {
            if (!(await confirmer({ message: `Payer ${formaterFcfa(totaux.aPayer)} de salaires depuis la caisse choisie ?`, libelleConfirmer: 'Payer tout' }))) return;
            try { const n = await repository.payerTout(ctx, periode, form); notifier('succes', `${n} salaire(s) payé(s).`); setModal(null); } catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Paiement impossible.'); }
          }} />
      )}
    </div>
  );
}
