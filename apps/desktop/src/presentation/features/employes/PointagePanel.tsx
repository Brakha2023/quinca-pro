import { useMemo, useState } from 'react';
import { CheckIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { STATUTS_POINTAGE, type StatutPointage } from '@quinca/shared-types';
import { LIBELLES_STATUT_POINTAGE, libellePeriode, nomComplet } from '../../../core/employes';
import { EmployesRepository } from '../../../infrastructure/powersync/repositories/EmployesRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import FormField, { inputClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useRepository } from '../../hooks/useRepository';
import { formaterDate } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useEmployes, usePointagesJour, usePointagesMois } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

const STYLE_STATUT: Record<StatutPointage, string> = { PRESENT: 'bg-green-600 text-white', ABSENT: 'bg-red-600 text-white', JUSTIFIE: 'bg-orange-500 text-white' };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Pointage quotidien (présent / absent / justifié) et récapitulatif du mois. */
export default function PointagePanel({ filialeId, filiale }: Props) {
  const repository = useRepository(EmployesRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const ctx = { filialeId, utilisateurId: utilisateur?.id ?? null };
  const [jour, setJour] = useState(aujourdhui);
  const [imprimer, setImprimer] = useState(false);
  const { employes } = useEmployes(filialeId);
  const pointages = usePointagesJour(filialeId, jour);
  const periode = jour.slice(0, 7);
  const duMois = usePointagesMois(filialeId, periode);
  const recap = useMemo(() => {
    const m = new Map<string, Record<StatutPointage, number>>();
    for (const p of duMois) {
      const r = m.get(p.employe_id) ?? { PRESENT: 0, ABSENT: 0, JUSTIFIE: 0 };
      r[p.statut]++;
      m.set(p.employe_id, r);
    }
    return m;
  }, [duMois]);
  const nonPointes = employes.filter((e) => !pointages.has(e.id)).length;

  const pointer = async (employeId: string, statut: StatutPointage) => {
    try { await repository.pointer(ctx, { employe_id: employeId, date_pointage: jour, statut, commentaire: '' }); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Pointage impossible.'); }
  };
  const tousPresents = async () => {
    try { await repository.pointerTous(ctx, employes.filter((e) => !pointages.has(e.id)).map((e) => e.id), jour, 'PRESENT'); notifier('succes', `Tous les employés non pointés sont marqués présents le ${formaterDate(jour)}.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Pointage impossible.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Jour"><input type="date" value={jour} max={aujourdhui()} onChange={(e) => setJour(e.target.value)} className={inputClass} /></FormField>
        <p className="text-sm text-neutral-600 pb-2">{employes.length - nonPointes} / {employes.length} pointé(s){nonPointes > 0 && <span className="text-orange-700"> · {nonPointes} à pointer</span>}</p>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setImprimer(true)} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Feuille de présence du mois</button>
          <button type="button" onClick={tousPresents} disabled={nonPointes === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><CheckIcon className="w-5 h-5" /> Tous présents</button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-3 text-left">Matricule</th><th className="px-3 py-3 text-left">Employé</th><th className="px-3 py-3 text-left">Fonction</th><th className="px-3 py-3 text-center">Pointage du {formaterDate(jour)}</th><th className="px-3 py-3 text-right">Présents</th><th className="px-3 py-3 text-right">Absents</th><th className="px-3 py-3 text-right">Justifiés</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {employes.map((e) => {
              const p = pointages.get(e.id);
              const r = recap.get(e.id) ?? { PRESENT: 0, ABSENT: 0, JUSTIFIE: 0 };
              return (
                <tr key={e.id} className="hover:bg-neutral-50" data-testid={`pointage-${e.matricule}`}>
                  <td className="px-3 py-2 text-sm font-mono text-primary-700">{e.matricule}</td>
                  <td className="px-3 py-2 text-sm font-medium">{nomComplet(e)}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{e.fonction ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-center gap-1">
                      {STATUTS_POINTAGE.map((s) => (
                        <button key={s} type="button" onClick={() => pointer(e.id, s)} className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${p?.statut === s ? STYLE_STATUT[s] : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'}`}>{LIBELLES_STATUT_POINTAGE[s]}</button>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{r.PRESENT}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-red-600">{r.ABSENT}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-orange-700">{r.JUSTIFIE}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {employes.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun employé actif.</div>}
      </div>
      <p className="text-xs text-neutral-500">Récapitulatif de {libellePeriode(periode)}. Les absences non justifiées sont retenues sur la paie du mois (1/26 du salaire par jour) ; les journaliers sont payés aux jours présents.</p>

      {imprimer && (
        <DocumentImprimable titre={`Feuille de présence — ${libellePeriode(periode)}`} filiale={filiale} onClose={() => setImprimer(false)}>
          <table className="document-liste">
            <thead><tr><th>Matricule</th><th>Employé</th><th>Fonction</th><th>Présents</th><th>Absents</th><th>Justifiés</th></tr></thead>
            <tbody>{employes.map((e) => { const r = recap.get(e.id) ?? { PRESENT: 0, ABSENT: 0, JUSTIFIE: 0 }; return <tr key={e.id}><td>{e.matricule}</td><td>{nomComplet(e)}</td><td>{e.fonction ?? ''}</td><td className="num">{r.PRESENT}</td><td className="num">{r.ABSENT}</td><td className="num">{r.JUSTIFIE}</td></tr>; })}</tbody>
            <tfoot><tr><td colSpan={6} className="document-liste-pied">Feuille de présence · {libellePeriode(periode)} · {filiale.nom} · {employes.length} employé(s) · éditée le {new Date().toLocaleDateString('fr-FR')}</td></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
