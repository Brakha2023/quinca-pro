import { useMemo, useState } from 'react';
import { PlusIcon, PrinterIcon, ReceiptPercentIcon } from '@heroicons/react/24/outline';
import { useQuery } from '@powersync/react';
import type { TypeReglement } from '@quinca/shared-types';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import { LIBELLES_NATURE_VERSEMENT, LIBELLES_TYPE_REGLEMENT, lettrerVersements, type FactureClient, type VersementLettre } from '../../../core/clients';
import { FACTURES_CLIENT_QUERY } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass } from '../../components/ui/FormField';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { formaterDateHeure } from '../ventes/VenteDetailsModal';
import ReglementModal from './ReglementModal';
import SelectClient from './SelectClient';
import { useClient, useClients, useVersements, type VersementVueRow } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

const premierJourDuMois = () => `${new Date().toISOString().slice(0, 7)}-01`;

/** Nouveau versement : choix du client puis encaissement. */
function NouveauVersement({ filialeId, onClose }: { filialeId: string; onClose: () => void }) {
  const [clientId, setClientId] = useState('');
  const client = useClient(clientId || null);
  if (client) return <ReglementModal filialeId={filialeId} client={client} onClose={onClose} />;
  return (
    <Modal titre="Nouveau versement" largeur="max-w-md" onClose={onClose}>
      <SelectClient filialeId={filialeId} value={clientId} onChange={setClientId} />
    </Modal>
  );
}

/** Lettrage d'un client (apport / utilisé / disponibilité) à partir de ses règlements et factures. */
function useLettrage(clientId: string | null) {
  const { data: reglements } = useQuery<{ id: string; date_reglement: string; montant: number; vente_id: string | null }>('SELECT id, date_reglement, montant, vente_id FROM reglements_clients WHERE client_id = ?', [clientId ?? '']);
  const { data: factures } = useQuery<FactureClient>(FACTURES_CLIENT_QUERY, [clientId ?? '']);
  return useMemo(() => new Map(lettrerVersements(reglements, factures).map((v) => [v.reglement_id, v])), [reglements, factures]);
}

/** Historique des versements de la filiale : bons payés et avances, montants utilisés et disponibilités, reçu et historique imprimables. */
export default function VersementsPanel({ filialeId, filiale }: Props) {
  const [clientId, setClientId] = useState('');
  const [dateDebut, setDateDebut] = useState(premierJourDuMois);
  const [dateFin, setDateFin] = useState('');
  const [modal, setModal] = useState<{ type: 'nouveau' } | { type: 'recu'; v: VersementVueRow } | { type: 'historique' } | null>(null);
  const { clients } = useClients(filialeId, { inclureInactifs: true });
  const { versements, isLoading } = useVersements(filialeId, { clientId: clientId || null, dateDebut: dateDebut || null, dateFin: dateFin || null });
  // Seule la page courante est rendue ; l'impression et l'export, eux,
  // reçoivent toujours `versements` en entier.
  const pages = usePagination(versements.length, [clientId, dateDebut, dateFin]);
  const affiches = pages.trancher(versements);
  // Le lettrage (utilisé / disponibilité) n'a de sens que client par client.
  const lettrage = useLettrage(clientId || null);
  const lettre = (v: VersementVueRow): VersementLettre | undefined => lettrage.get(v.id);
  const nature = (v: VersementVueRow) => LIBELLES_NATURE_VERSEMENT[v.vente_id ? 'BON_PAYE' : 'AVANCE_PAYEE'];
  const total = versements.reduce((s, v) => s + (v.montant ?? 0), 0);
  const totalUtilise = clientId ? versements.reduce((s, v) => s + (lettre(v)?.utilise ?? 0), 0) : null;
  const totalDispo = clientId ? versements.reduce((s, v) => s + (lettre(v)?.disponibilite ?? 0), 0) : null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 items-end">
        <div className="col-span-2"><SelectClient filialeId={filialeId} value={clientId} onChange={setClientId} obligatoire={false} vide="Tous les clients" /></div>
        <FormField label="Du"><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={inputClass} /></FormField>
        <FormField label="Au"><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={inputClass} /></FormField>
        <div className="col-span-2 flex gap-2 justify-end">
          <button type="button" onClick={() => setModal({ type: 'historique' })} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer l'historique</button>
          <button type="button" onClick={() => setModal({ type: 'nouveau' })} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Nouveau versement</button>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Apports sur la période</p><p className="text-xl font-bold font-mono text-green-700 mt-1">{formaterFcfa(total)}</p><p className="text-xs text-neutral-500">{versements.length} versement(s)</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Montant utilisé</p><p className="text-xl font-bold font-mono mt-1">{totalUtilise != null ? formaterFcfa(totalUtilise) : '—'}</p>{totalUtilise == null && <p className="text-xs text-neutral-500">Choisissez un client</p>}</div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Disponibilité (avances restantes)</p><p className="text-xl font-bold font-mono text-blue-700 mt-1">{totalDispo != null ? formaterFcfa(totalDispo) : '—'}</p></div>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">N° règlement</th><th className="px-3 py-2 text-left">Désignation</th><th className="px-3 py-2 text-right">Apport</th><th className="px-3 py-2 text-right">Mt. utilisé</th><th className="px-3 py-2 text-right">Disponibilité</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-left">N° chèque / réf.</th><th className="px-3 py-2 text-left">Client</th><th className="px-3 py-2 text-left">N° vente</th><th className="px-3 py-2 text-left">Utilisateur</th><th className="w-10" /></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {affiches.map((v) => {
              const l = lettre(v);
              return (
                <tr key={v.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDate(v.date_reglement)}</td>
                  <td className="px-3 py-2 text-sm font-mono">{v.numero}</td>
                  <td className="px-3 py-2 text-sm">{nature(v)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{formaterFcfa(v.montant)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{l ? formaterFcfa(l.utilise) : '—'}</td>
                  <td className={`px-3 py-2 text-sm text-right font-mono ${l && l.disponibilite > 0 ? 'bg-green-100 text-green-800 font-semibold' : 'text-neutral-500'}`}>{l ? formaterFcfa(l.disponibilite) : '—'}</td>
                  <td className="px-3 py-2 text-sm">{LIBELLES_TYPE_REGLEMENT[(v.type_reglement ?? 'ESPECES') as TypeReglement]}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{v.reference ?? '—'}</td>
                  <td className="px-3 py-2 text-sm font-medium">{v.client_nom}</td>
                  <td className="px-3 py-2 text-sm font-mono text-neutral-600">{v.vente_numero ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{[v.utilisateur_prenom, v.utilisateur_nom].filter(Boolean).join(' ') || '—'}</td>
                  <td className="px-3 py-2 text-center"><button type="button" onClick={() => setModal({ type: 'recu', v })} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700" title="Reçu de versement"><ReceiptPercentIcon className="w-4 h-4" /></button></td>
                </tr>
              );
            })}
          </tbody>
          {versements.length > 0 && (
            <tfoot className="bg-neutral-50 border-t border-neutral-200 text-sm font-semibold">
              <tr><td colSpan={3} className="px-3 py-2 text-right">Total</td><td className="px-3 py-2 text-right font-mono">{formaterFcfa(total)}</td><td className="px-3 py-2 text-right font-mono">{totalUtilise != null ? formaterFcfa(totalUtilise) : ''}</td><td className="px-3 py-2 text-right font-mono text-green-800">{totalDispo != null ? formaterFcfa(totalDispo) : ''}</td><td colSpan={6} /></tr>
            </tfoot>
          )}
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && versements.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun versement sur la période.</div>}
      </div>

      <Pagination etat={pages} nom="versement" data-testid="pagination-versements" />

      {modal?.type === 'nouveau' && <NouveauVersement filialeId={filialeId} onClose={() => setModal(null)} />}
      {modal?.type === 'recu' && (
        <DocumentImprimable titre="Reçu de versement" filiale={filiale} onClose={() => setModal(null)}>
          <div className="document-cartouches">
            <table style={{ width: '48%', margin: 0 }}><tbody>
              <tr><th>N° reçu</th><td>{modal.v.numero}</td></tr>
              <tr><th>Date</th><td>{formaterDateHeure(modal.v.date_reglement)}</td></tr>
              <tr><th>Nature</th><td>{nature(modal.v)}{modal.v.vente_numero ? ` — vente ${modal.v.vente_numero}` : ''}</td></tr>
              <tr><th>Mode</th><td>{LIBELLES_TYPE_REGLEMENT[(modal.v.type_reglement ?? 'ESPECES') as TypeReglement]}{modal.v.reference ? ` · ${modal.v.reference}` : ''}</td></tr>
            </tbody></table>
            <div className="document-bloc" style={{ width: '48%' }}><strong>Reçu de</strong><br />{modal.v.client_nom}<br />Code : {modal.v.client_code}</div>
          </div>
          <table><tbody><tr><th style={{ textAlign: 'left' }}>Montant versé</th><td className="num" style={{ fontSize: 16 }}><strong>{formaterFcfa(modal.v.montant)}</strong></td></tr></tbody></table>
          <p>Encaissé par {[modal.v.utilisateur_prenom, modal.v.utilisateur_nom].filter(Boolean).join(' ')}{modal.v.caisse_nom ? ` · ${modal.v.caisse_nom}` : ''}</p>
          <div className="document-cartouches"><table style={{ width: '70mm', margin: 0 }}><thead><tr><th>Cachet / Signature</th></tr></thead><tbody><tr><td className="document-signature" /></tr></tbody></table></div>
        </DocumentImprimable>
      )}
      {modal?.type === 'historique' && (
        <DocumentImprimable titre="Historique des versements clients" filiale={filiale} onClose={() => setModal(null)}>
          <p>{clientId ? clients.find((c) => c.id === clientId)?.raison_sociale : 'Tous clients'} · du {dateDebut || '…'} au {dateFin || '…'} · édité le {new Date().toLocaleDateString('fr-FR')}</p>
          <table className="document-liste">
            <thead><tr><th>Date</th><th>N° règlement</th><th>Désignation</th><th>Apport</th>{clientId && <th>Utilisé</th>}{clientId && <th>Disponibilité</th>}<th>Type</th><th>Client</th><th>N° vente</th></tr></thead>
            <tbody>{versements.map((v) => { const l = lettre(v); return <tr key={v.id}><td>{formaterDate(v.date_reglement)}</td><td>{v.numero}</td><td>{nature(v)}</td><td className="num">{formaterFcfa(v.montant)}</td>{clientId && <td className="num">{l ? formaterFcfa(l.utilise) : ''}</td>}{clientId && <td className="num">{l ? formaterFcfa(l.disponibilite) : ''}</td>}<td>{LIBELLES_TYPE_REGLEMENT[(v.type_reglement ?? 'ESPECES') as TypeReglement]}</td><td>{v.client_nom}</td><td>{v.vente_numero ?? ''}</td></tr>; })}
              <tr><th colSpan={3}>Total</th><th className="num">{formaterFcfa(total)}</th>{clientId && <th className="num">{formaterFcfa(totalUtilise ?? 0)}</th>}{clientId && <th className="num">{formaterFcfa(totalDispo ?? 0)}</th>}<th colSpan={3} /></tr>
            </tbody>
            <tfoot><tr><td colSpan={clientId ? 9 : 7} className="document-liste-pied">Historique des versements clients · {filiale.nom} · {clientId ? clients.find((c) => c.id === clientId)?.raison_sociale : 'tous clients'} · du {dateDebut || '…'} au {dateFin || '…'} · total {formaterFcfa(total)} · édité le {new Date().toLocaleDateString('fr-FR')}</td></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
