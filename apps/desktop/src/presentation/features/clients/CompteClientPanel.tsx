import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BanknotesIcon, PrinterIcon } from '@heroicons/react/24/outline';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { LIBELLES_PERIODE_REGLEMENT_CLIENT, construireReleveClient, disponibiliteCredit } from '../../../core/clients';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import FormField, { inputClass } from '../../components/ui/FormField';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import ReglementModal from './ReglementModal';
import SelectClient from './SelectClient';
import { useClient, useFacturesClient, useReglementsClient } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/** Compte client : solde initial, factures (débit), règlements (crédit), disponibilité et solde cumulé ; relevé imprimable. */
export default function CompteClientPanel({ filialeId, filiale }: Props) {
  const [params, setParams] = useSearchParams();
  const clientId = params.get('id') ?? '';
  const client = useClient(clientId || null);
  const { factures } = useFacturesClient(clientId || null);
  const { reglements } = useReglementsClient(clientId || null);
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');
  const [modal, setModal] = useState<'reglement' | 'imprimer' | null>(null);

  const releveComplet = useMemo(() => (client ? construireReleveClient(client, factures, reglements) : []), [client, factures, reglements]);
  // La période ne filtre que l'affichage : le solde cumulé reste juste (calculé sur tout l'historique).
  const releve = releveComplet.filter((l, i) => i === 0 || ((!dateDebut || l.date.slice(0, 10) >= dateDebut) && (!dateFin || l.date.slice(0, 10) <= dateFin)));
  const totalFacture = releve.reduce((s, l) => s + l.facture, 0);
  const totalReglement = releve.reduce((s, l) => s + l.reglement, 0);

  // La page courante à l'écran, le relevé entier sur le papier : la fonction
  // prend donc ses lignes au lieu de les chercher elle-même.
  const pages = usePagination(releve.length, [clientId, dateDebut, dateFin]);
  const lignesTable = (lignes: typeof releve, imprimer: boolean) => lignes.map((l, i) => (
    // Le solde d'ouverture se reconnaît à ce qu'il est, non à son rang : en
    // page deux, le premier rang est une opération comme une autre.
    <tr key={i} className={!imprimer && l === releve[0] ? 'bg-neutral-50 font-medium' : ''}>
      <td className={imprimer ? '' : 'px-3 py-2 text-sm text-neutral-600 whitespace-nowrap'}>{formaterDate(l.date)}</td>
      <td className={imprimer ? '' : 'px-3 py-2 text-sm font-mono'}>{l.piece}</td>
      <td className={imprimer ? '' : 'px-3 py-2 text-sm'}>{l.designation}</td>
      <td className={imprimer ? 'num' : 'px-3 py-2 text-sm text-right font-mono text-red-600'}>{l.facture ? formaterFcfa(l.facture) : ''}</td>
      <td className={imprimer ? 'num' : 'px-3 py-2 text-sm text-right font-mono text-green-700'}>{l.reglement ? formaterFcfa(l.reglement) : ''}</td>
      <td className={imprimer ? 'num' : 'px-3 py-2 text-sm text-right font-mono text-blue-700'}>{l.disponibilite ? formaterFcfa(l.disponibilite) : ''}</td>
      <td className={imprimer ? 'num' : `px-3 py-2 text-sm text-right font-mono font-semibold ${l.solde > 0 ? 'text-red-600' : l.solde < 0 ? 'text-blue-700' : ''}`}>{formaterFcfa(l.solde)}</td>
    </tr>
  ));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
        <div className="col-span-2"><SelectClient filialeId={filialeId} value={clientId} onChange={(id) => setParams(id ? { id } : {})} /></div>
        <FormField label="Du"><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} /></FormField>
        <FormField label="Au"><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} /></FormField>
        {client && (
          <div className="col-span-2 flex gap-2 justify-end">
            <button type="button" onClick={() => setModal('imprimer')} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer</button>
            <button type="button" onClick={() => setModal('reglement')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"><BanknotesIcon className="w-5 h-5" /> Règlement</button>
          </div>
        )}
      </div>

      {client ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4" data-testid="compte-client-indicateurs">
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Solde initial{client.date_effet_solde ? ` au ${formaterDate(client.date_effet_solde)}` : ''}</p><p className="text-xl font-bold font-mono mt-1">{formaterFcfa(client.solde_initial)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Facture (débit)</p><p className="text-xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(client.cumul_factures)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Règlement (crédit)</p><p className="text-xl font-bold font-mono text-green-700 mt-1">{formaterFcfa(client.cumul_reglements)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Solde en cours</p><p className={`text-xl font-bold font-mono mt-1 ${client.solde_actuel > 0 ? 'text-red-600' : client.solde_actuel < 0 ? 'text-blue-700' : 'text-green-700'}`}>{formaterFcfa(client.solde_actuel)}</p><p className="text-xs text-neutral-500">{client.solde_actuel > 0 ? 'Le client doit' : client.solde_actuel < 0 ? 'Avance disponible' : 'Compte soldé'}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Disponibilité (crédit)</p><p className="text-xl font-bold font-mono text-blue-700 mt-1">{formaterFcfa(disponibiliteCredit(client))}</p><p className="text-xs text-neutral-500">Plafond {formaterFcfa(client.plafond_credit)}</p></div>
            <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Conditions</p><p className="text-sm font-medium mt-1">{client.periode_reglement ? LIBELLES_PERIODE_REGLEMENT_CLIENT[client.periode_reglement] : '—'}</p><p className="text-xs text-neutral-500">Remise {client.remise_percent} %</p></div>
          </div>
          <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
            <table className="tableau">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
                <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">N° pièce</th><th className="px-3 py-2 text-left">Désignation</th><th className="px-3 py-2 text-right">Facture</th><th className="px-3 py-2 text-right">Règlement</th><th className="px-3 py-2 text-right">Disponibilité</th><th className="px-3 py-2 text-right">Solde</th></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">{lignesTable(pages.trancher(releve), false)}</tbody>
              <tfoot className="bg-yellow-50 border-t border-neutral-200 text-sm font-semibold">
                <tr><td colSpan={3} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right font-mono text-red-600">{formaterFcfa(totalFacture)}</td><td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(totalReglement)}</td><td className="px-3 py-2 text-right font-mono text-blue-700">{formaterFcfa(Math.max(-client.solde_actuel, 0))}</td><td className="px-3 py-2 text-right font-mono">{formaterFcfa(client.solde_actuel)}</td></tr>
              </tfoot>
            </table>
          </div>

          <Pagination etat={pages} nom="ligne" data-testid="pagination-compte-client" />
        </>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">Choisissez un client pour consulter ses opérations.</div>
      )}

      {modal === 'reglement' && client && <ReglementModal filialeId={filialeId} client={client} onClose={() => setModal(null)} />}
      {modal === 'imprimer' && client && (
        <DocumentImprimable titre={`Relevé de compte — ${client.raison_sociale}`} filiale={filiale} onClose={() => setModal(null)}>
          <div className="document-cartouches">
            <div className="document-bloc"><strong>{client.raison_sociale}</strong><br />Code : {client.numero_compte ?? client.code}<br />{client.adresse ?? ''}<br />{client.mobile ?? client.telephone ?? ''}</div>
            <div className="document-bloc">{dateDebut || dateFin ? `Période du ${dateDebut || '…'} au ${dateFin || '…'}` : `Arrêté au ${new Date().toLocaleDateString('fr-FR')}`}<br />Solde d'ouverture : {formaterFcfa(client.solde_initial)}<br />Solde : <strong>{formaterFcfa(client.solde_actuel)}</strong></div>
          </div>
          <table className="document-liste">
            <thead><tr><th>Date</th><th>N° pièce</th><th>Désignation</th><th>Facture</th><th>Règlement</th><th>Disponibilité</th><th>Solde</th></tr></thead>
            <tbody>
              {lignesTable(releve, true)}
              <tr><th colSpan={3}>Total</th><th className="num">{formaterFcfa(totalFacture)}</th><th className="num">{formaterFcfa(totalReglement)}</th><th className="num">{formaterFcfa(Math.max(-client.solde_actuel, 0))}</th><th className="num">{formaterFcfa(client.solde_actuel)}</th></tr>
            </tbody>
            <tfoot><tr><td colSpan={7} className="document-liste-pied">Relevé de compte · {client.raison_sociale} · {filiale.nom} · solde {formaterFcfa(client.solde_actuel)} · édité le {new Date().toLocaleDateString('fr-FR')}</td></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
