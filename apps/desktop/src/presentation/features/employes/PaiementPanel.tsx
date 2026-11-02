import { useState } from 'react';
import { DocumentTextIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { LIBELLES_STATUT_PAIE, LIBELLES_TYPE_CONTRAT, libellePeriode, nomComplet, periodeCourante } from '../../../core/employes';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import SelectPeriode from './SelectPeriode';
import { usePaies, type PaieVue } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

type Document = { type: 'emargement'; avecSalaire: boolean } | { type: 'bulletin'; p: PaieVue } | { type: 'bulletins' } | null;

function Bulletin({ p, filiale }: { p: PaieVue; filiale: Props['filiale'] }) {
  return (
    <div className="document-bloc" style={{ marginBottom: 12, pageBreakInside: 'avoid' }}>
      <div className="document-cartouches" style={{ margin: 0 }}>
        <div><strong>{nomComplet(p)}</strong><br />Matricule {p.matricule} · {p.fonction ?? ''}<br />{LIBELLES_TYPE_CONTRAT[p.type_contrat as keyof typeof LIBELLES_TYPE_CONTRAT] ?? p.type_contrat}</div>
        <div style={{ textAlign: 'right' }}>Bulletin de paie<br /><strong>{libellePeriode(p.periode)}</strong><br />{filiale.nom}</div>
      </div>
      <table>
        <tbody>
          <tr><td>{p.type_contrat === 'JOURNALIER' ? `Taux journalier × ${p.jours_presents} jour(s)` : 'Salaire de base'}</td><td className="num">{formaterFcfa(p.type_contrat === 'JOURNALIER' ? p.brut : p.salaire_base)}</td></tr>
          {p.retenue_absences > 0 && <tr><td>Retenue absences ({p.jours_absents} jour(s) non justifié(s))</td><td className="num">−{formaterFcfa(p.retenue_absences)}</td></tr>}
          <tr><td><strong>Brut</strong></td><td className="num"><strong>{formaterFcfa(p.brut)}</strong></td></tr>
          {p.primes > 0 && <tr><td>Primes</td><td className="num">+{formaterFcfa(p.primes)}</td></tr>}
          {p.retenues > 0 && <tr><td>Retenues</td><td className="num">−{formaterFcfa(p.retenues)}</td></tr>}
          {p.avances > 0 && <tr><td>Avances sur salaire déjà versées</td><td className="num">−{formaterFcfa(p.avances)}</td></tr>}
          <tr><td><strong>Net à payer</strong></td><td className="num" style={{ fontSize: 14 }}><strong>{formaterFcfa(p.net_a_payer)}</strong></td></tr>
        </tbody>
      </table>
      <p style={{ margin: 0, fontSize: 10 }}>Présences : {p.jours_presents} · absences : {p.jours_absents} · justifiées : {p.jours_justifies}{p.statut === 'PAYEE' && p.date_paiement ? ` · payé le ${formaterDate(p.date_paiement)}${p.caisse_nom ? ` (${p.caisse_nom})` : ''}` : ''}{p.notes ? ` · ${p.notes}` : ''}</p>
    </div>
  );
}

/** Paiement de salaire : fiches d'émargement (sans / avec montants) et bulletins de paie du mois. */
export default function PaiementPanel({ filialeId, filiale }: Props) {
  const [periode, setPeriode] = useState(periodeCourante);
  const [document, setDocument] = useState<Document>(null);
  const { paies } = usePaies(filialeId, periode);
  const total = paies.reduce((s, p) => s + p.net_a_payer, 0);
  const payees = paies.filter((p) => p.statut === 'PAYEE');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <SelectPeriode value={periode} onChange={setPeriode} />
        <div className="ml-auto flex flex-wrap gap-2">
          <button type="button" onClick={() => setDocument({ type: 'emargement', avecSalaire: false })} disabled={paies.length === 0} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Émargement sans salaire</button>
          <button type="button" onClick={() => setDocument({ type: 'emargement', avecSalaire: true })} disabled={paies.length === 0} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Émargement avec salaire</button>
          <button type="button" onClick={() => setDocument({ type: 'bulletins' })} disabled={paies.length === 0} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><DocumentTextIcon className="w-5 h-5" /> Bulletins de paie</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Net total du mois</p><p className="text-xl font-bold font-mono mt-1">{formaterFcfa(total)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Payé</p><p className="text-xl font-bold font-mono text-green-700 mt-1">{formaterFcfa(payees.reduce((s, p) => s + p.net_a_payer, 0))}</p><p className="text-xs text-neutral-500">{payees.length} / {paies.length} employé(s)</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Reste à payer</p><p className="text-xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(total - payees.reduce((s, p) => s + p.net_a_payer, 0))}</p></div>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-3 text-left">Matricule</th><th className="px-3 py-3 text-left">Employé</th><th className="px-3 py-3 text-left">Fonction</th><th className="px-3 py-3 text-right">Net à payer</th><th className="px-3 py-3 text-left">Statut</th><th className="px-3 py-3 text-left">Paiement</th><th className="px-3 py-3 text-center">Bulletin</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {paies.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm font-mono text-primary-700">{p.matricule}</td>
                <td className="px-3 py-2 text-sm font-medium">{nomComplet(p)}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{p.fonction ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-bold">{formaterFcfa(p.net_a_payer)}</td>
                <td className="px-3 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.statut === 'PAYEE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{LIBELLES_STATUT_PAIE[p.statut]}</span></td>
                <td className="px-3 py-2 text-sm text-neutral-600">{p.date_paiement ? `${formaterDate(p.date_paiement)}${p.caisse_nom ? ` · ${p.caisse_nom}` : ''}${p.reference ? ` · ${p.reference}` : ''}` : '—'}</td>
                <td className="px-3 py-2 text-center"><button type="button" onClick={() => setDocument({ type: 'bulletin', p })} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700" title="Bulletin de paie"><DocumentTextIcon className="w-4 h-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {paies.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune paie pour {libellePeriode(periode)} : générez-la dans « Paie / salaire ».</div>}
      </div>

      {document?.type === 'emargement' && (
        <DocumentImprimable titre={`Fiche d'émargement — ${libellePeriode(periode)}`} filiale={filiale} onClose={() => setDocument(null)}>
          <p>Paiement des salaires de {libellePeriode(periode)} · {paies.length} employé(s){document.avecSalaire ? ` · total ${formaterFcfa(total)}` : ''}</p>
          <table>
            <thead><tr><th>N°</th><th>Matricule</th><th>Nom et prénom</th><th>Fonction</th>{document.avecSalaire && <th>Net payé</th>}<th style={{ width: '38mm' }}>Émargement</th></tr></thead>
            <tbody>{paies.map((p, i) => <tr key={p.id} style={{ height: 34 }}><td className="num">{i + 1}</td><td>{p.matricule}</td><td>{nomComplet(p)}</td><td>{p.fonction ?? ''}</td>{document.avecSalaire && <td className="num">{formaterFcfa(p.net_a_payer)}</td>}<td /></tr>)}</tbody>
            {document.avecSalaire && <tfoot><tr><th colSpan={4}>Total</th><th className="num">{formaterFcfa(total)}</th><th /></tr></tfoot>}
          </table>
          <div className="document-cartouches"><div className="document-bloc" style={{ width: '60mm', height: '25mm' }}>Le caissier</div><div className="document-bloc" style={{ width: '60mm', height: '25mm' }}>Le gérant</div></div>
        </DocumentImprimable>
      )}
      {document?.type === 'bulletin' && <DocumentImprimable titre="Bulletin de paie" filiale={filiale} onClose={() => setDocument(null)}><Bulletin p={document.p} filiale={filiale} /></DocumentImprimable>}
      {document?.type === 'bulletins' && <DocumentImprimable titre={`Bulletins de paie — ${libellePeriode(periode)}`} filiale={filiale} onClose={() => setDocument(null)}>{paies.map((p) => <Bulletin key={p.id} p={p} filiale={filiale} />)}</DocumentImprimable>}
    </div>
  );
}
