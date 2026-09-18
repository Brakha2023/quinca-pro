import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BanknotesIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { LIBELLES_PERIODE_REGLEMENT, construireReleve } from '../../../core/fournisseurs';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import ReglementFournisseurModal from './ReglementFournisseurModal';
import SelectFournisseur from './SelectFournisseur';
import { useAchatsFournisseur, useFournisseur, useReglementsFournisseur } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/** Compte fournisseur : solde initial, débits (factures), crédits (règlements), solde cumulé et actuel ; relevé imprimable. */
export default function CompteFournisseurPanel({ filialeId, filiale }: Props) {
  const [params, setParams] = useSearchParams();
  const fournisseurId = params.get('id') ?? '';
  const fournisseur = useFournisseur(fournisseurId || null);
  const commandes = useAchatsFournisseur(fournisseurId || null);
  const reglements = useReglementsFournisseur(fournisseurId || null);
  const [modal, setModal] = useState<'reglement' | 'imprimer' | null>(null);
  const releve = fournisseur ? construireReleve(fournisseur, commandes, reglements) : [];
  const totalDebit = releve.reduce((s, l) => s + l.debit, 0);
  const totalCredit = releve.reduce((s, l) => s + l.credit, 0);

  const tableau = (
    <table className="w-full">
      <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
        <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Pièce</th><th className="px-3 py-2 text-left">Libellé</th><th className="px-3 py-2 text-right">Débit</th><th className="px-3 py-2 text-right">Crédit</th><th className="px-3 py-2 text-right">Solde</th></tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {releve.map((l, i) => (
          <tr key={i} className={i === 0 ? 'bg-neutral-50 font-medium' : ''}>
            <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDate(l.date)}</td>
            <td className="px-3 py-2 text-sm font-mono">{l.piece}</td>
            <td className="px-3 py-2 text-sm">{l.libelle}</td>
            <td className="px-3 py-2 text-sm text-right font-mono text-red-600">{l.debit ? formaterFcfa(l.debit) : ''}</td>
            <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{l.credit ? formaterFcfa(l.credit) : ''}</td>
            <td className={`px-3 py-2 text-sm text-right font-mono font-semibold ${l.solde > 0 ? 'text-red-600' : l.solde < 0 ? 'text-blue-700' : ''}`}>{formaterFcfa(l.solde)}</td>
          </tr>
        ))}
      </tbody>
      {fournisseur && (
        <tfoot className="bg-neutral-50 border-t border-neutral-200 text-sm font-semibold">
          <tr><td colSpan={3} className="px-3 py-2 text-right">Totaux</td><td className="px-3 py-2 text-right font-mono text-red-600">{formaterFcfa(totalDebit)}</td><td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(totalCredit)}</td><td className="px-3 py-2 text-right font-mono">{formaterFcfa(fournisseur.solde_actuel)}</td></tr>
        </tfoot>
      )}
    </table>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <SelectFournisseur filialeId={filialeId} value={fournisseurId} onChange={(id) => setParams(id ? { id } : {})} />
        {fournisseur && (
          <div className="md:col-span-2 flex flex-wrap gap-2 justify-end">
            <button type="button" onClick={() => setModal('imprimer')} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer le relevé</button>
            <button type="button" onClick={() => setModal('reglement')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"><BanknotesIcon className="w-5 h-5" /> Règlement</button>
          </div>
        )}
      </div>

      {fournisseur ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4" data-testid="compte-indicateurs">
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Solde initial{fournisseur.date_effet_solde ? ` au ${formaterDate(fournisseur.date_effet_solde)}` : ''}</p><p className="text-xl font-bold font-mono mt-1">{formaterFcfa(fournisseur.solde_initial)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Débit (factures)</p><p className="text-xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(fournisseur.cumul_factures)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Crédit (règlements)</p><p className="text-xl font-bold font-mono text-green-700 mt-1">{formaterFcfa(fournisseur.cumul_reglements)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Solde actuel</p><p className={`text-xl font-bold font-mono mt-1 ${fournisseur.solde_actuel > 0 ? 'text-red-600' : fournisseur.solde_actuel < 0 ? 'text-blue-700' : 'text-green-700'}`}>{formaterFcfa(fournisseur.solde_actuel)}</p><p className="text-xs text-neutral-500">{fournisseur.solde_actuel > 0 ? 'Nous devons' : fournisseur.solde_actuel < 0 ? 'Avoir en notre faveur' : 'Compte soldé'}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Conditions</p><p className="text-sm font-medium mt-1">{fournisseur.periode_reglement ? LIBELLES_PERIODE_REGLEMENT[fournisseur.periode_reglement] : '—'}</p><p className="text-xs text-neutral-500">Plafond {formaterFcfa(fournisseur.plafond_credit)}{fournisseur.delai_echeance_jours ? ` · échéance ${fournisseur.delai_echeance_jours} j` : ''}</p></div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">{tableau}</div>
        </>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">Choisissez un fournisseur pour consulter son compte.</div>
      )}

      {modal === 'reglement' && fournisseur && <ReglementFournisseurModal filialeId={filialeId} fournisseur={fournisseur} onClose={() => setModal(null)} />}
      {modal === 'imprimer' && fournisseur && (
        <DocumentImprimable titre={`Relevé de compte — ${fournisseur.raison_sociale}`} filiale={filiale} onClose={() => setModal(null)}>
          <div className="document-cartouches">
            <div className="document-bloc"><strong>{fournisseur.raison_sociale}</strong><br />N° compte : {fournisseur.numero_compte ?? fournisseur.code}<br />{fournisseur.adresse ?? ''}<br />{fournisseur.telephone ?? fournisseur.mobile ?? ''}</div>
            <div className="document-bloc">Arrêté au {new Date().toLocaleDateString('fr-FR')}<br />Solde actuel : <strong>{formaterFcfa(fournisseur.solde_actuel)}</strong></div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Pièce</th><th>Libellé</th><th>Débit</th><th>Crédit</th><th>Solde</th></tr></thead>
            <tbody>{releve.map((l, i) => <tr key={i}><td>{formaterDate(l.date)}</td><td>{l.piece}</td><td>{l.libelle}</td><td className="num">{l.debit ? formaterFcfa(l.debit) : ''}</td><td className="num">{l.credit ? formaterFcfa(l.credit) : ''}</td><td className="num">{formaterFcfa(l.solde)}</td></tr>)}</tbody>
            <tfoot><tr><th colSpan={3}>Totaux</th><th className="num">{formaterFcfa(totalDebit)}</th><th className="num">{formaterFcfa(totalCredit)}</th><th className="num">{formaterFcfa(fournisseur.solde_actuel)}</th></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
