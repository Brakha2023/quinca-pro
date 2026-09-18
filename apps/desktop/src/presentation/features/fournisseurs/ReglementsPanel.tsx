import { useState } from 'react';
import { PrinterIcon } from '@heroicons/react/24/outline';
import { LIBELLES_TYPE_REGLEMENT } from '../../../core/clients';
import type { TypeReglement } from '@quinca/shared-types';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import FormField, { inputClass } from '../../components/ui/FormField';
import { formaterFcfa } from '../../hooks/useFormatage';
import { formaterDateHeure } from '../ventes/VenteDetailsModal';
import { useFournisseurs, useReglementsFournisseurs } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/** Historique des règlements fournisseurs de la filiale, filtrable et imprimable. */
export default function ReglementsPanel({ filialeId, filiale }: Props) {
  const [fournisseurId, setFournisseurId] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [imprimer, setImprimer] = useState(false);
  const { fournisseurs } = useFournisseurs(filialeId, { inclureInactifs: true });
  const { reglements, isLoading } = useReglementsFournisseurs(filialeId, { fournisseurId: fournisseurId || null, dateDebut: dateDebut || null, dateFin: dateFin || null });
  const total = reglements.reduce((s, r) => s + (r.montant ?? 0), 0);
  const parType = reglements.reduce<Record<string, number>>((acc, r) => { const t = r.type_reglement ?? 'ESPECES'; acc[t] = (acc[t] ?? 0) + (r.montant ?? 0); return acc; }, {});

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
        <FormField label="Fournisseur" className="md:col-span-2">
          <select value={fournisseurId} onChange={(e) => setFournisseurId(e.target.value)} className={inputClass}><option value="">Tous</option>{fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.raison_sociale}</option>)}</select>
        </FormField>
        <FormField label="Du"><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} /></FormField>
        <FormField label="Au"><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} /></FormField>
        <button type="button" onClick={() => setImprimer(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Total réglé</p><p className="text-xl font-bold font-mono text-green-700 mt-1">{formaterFcfa(total)}</p><p className="text-xs text-neutral-500">{reglements.length} règlement(s)</p></div>
        {(Object.keys(LIBELLES_TYPE_REGLEMENT) as TypeReglement[]).map((t) => (
          <div key={t} className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">{LIBELLES_TYPE_REGLEMENT[t]}</p><p className="text-xl font-bold font-mono mt-1">{formaterFcfa(parType[t] ?? 0)}</p></div>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">N° pièce</th><th className="px-3 py-2 text-left">Fournisseur</th><th className="px-3 py-2 text-left">Mode</th><th className="px-3 py-2 text-left">Référence</th><th className="px-3 py-2 text-left">Commande</th><th className="px-3 py-2 text-left">Caisse</th><th className="px-3 py-2 text-left">Par</th><th className="px-3 py-2 text-right">Montant</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {reglements.map((r) => (
              <tr key={r.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(r.date_reglement)}</td>
                <td className="px-3 py-2 text-sm font-mono">{r.numero}</td>
                <td className="px-3 py-2 text-sm font-medium">{r.fournisseur_nom}</td>
                <td className="px-3 py-2 text-sm">{LIBELLES_TYPE_REGLEMENT[(r.type_reglement ?? 'ESPECES') as TypeReglement]}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{r.reference ?? '—'}</td>
                <td className="px-3 py-2 text-sm font-mono text-neutral-600">{r.commande_numero ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{r.caisse_nom ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{[r.utilisateur_prenom, r.utilisateur_nom].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-semibold text-green-700">{formaterFcfa(r.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && reglements.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun règlement sur la période.</div>}
      </div>
      {imprimer && (
        <DocumentImprimable titre="Historique des règlements fournisseurs" filiale={filiale} onClose={() => setImprimer(false)}>
          <p>{fournisseurId ? fournisseurs.find((f) => f.id === fournisseurId)?.raison_sociale : 'Tous fournisseurs'}{dateDebut || dateFin ? ` · du ${dateDebut || '…'} au ${dateFin || '…'}` : ''} · édité le {new Date().toLocaleDateString('fr-FR')}</p>
          <table>
            <thead><tr><th>Date</th><th>N° pièce</th><th>Fournisseur</th><th>Mode</th><th>Référence</th><th>Montant</th></tr></thead>
            <tbody>{reglements.map((r) => <tr key={r.id}><td>{formaterDateHeure(r.date_reglement)}</td><td>{r.numero}</td><td>{r.fournisseur_nom}</td><td>{LIBELLES_TYPE_REGLEMENT[(r.type_reglement ?? 'ESPECES') as TypeReglement]}</td><td>{r.reference ?? ''}</td><td className="num">{formaterFcfa(r.montant)}</td></tr>)}</tbody>
            <tfoot><tr><th colSpan={5}>Total</th><th className="num">{formaterFcfa(total)}</th></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
