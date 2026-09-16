import { useState } from 'react';
import { BanknotesIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { LIBELLES_TYPE_REGLEMENT, disponibiliteCredit, statutCredit, type StatutCredit } from '../../../core/clients';
import Modal from '../../components/ui/Modal';
import { formaterFcfa, formaterDate } from '../../hooks/useFormatage';
import ClientFormModal from './ClientFormModal';
import ReglementModal from './ReglementModal';
import { useClient, useReglementsClient } from './hooks';

export const STATUT_CREDIT_STYLE: Record<StatutCredit, { label: string; cls: string }> = {
  A_JOUR: { label: 'À jour', cls: 'bg-green-100 text-green-700' },
  AVOIR: { label: 'Avoir', cls: 'bg-blue-100 text-blue-700' },
  EN_COURS: { label: 'En cours', cls: 'bg-orange-100 text-orange-700' },
  DEPASSE: { label: 'Plafond dépassé', cls: 'bg-red-100 text-red-700' },
};

function Kpi({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${tone}`}>{value}</p>
    </div>
  );
}

/** Fiche client temps réel : situation de compte, historique des règlements, actions. */
export default function ClientDetailsModal({ filialeId, clientId, onClose }: { filialeId: string; clientId: string; onClose: () => void }) {
  const client = useClient(clientId);
  const { reglements } = useReglementsClient(clientId);
  const [modal, setModal] = useState<'modifier' | 'reglement' | null>(null);

  if (!client) return null;
  const statut = STATUT_CREDIT_STYLE[statutCredit(client)];

  return (
    <>
      <Modal
        titre={client.raison_sociale}
        sousTitre={`${client.code} · ${client.mobile || 'Sans mobile'} · ${client.email || 'Sans email'}`}
        largeur="max-w-4xl"
        onClose={onClose}
        pied={
          <>
            <button type="button" onClick={() => setModal('modifier')} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PencilSquareIcon className="w-4 h-4" /> Modifier</button>
            <button type="button" onClick={() => setModal('reglement')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"><BanknotesIcon className="w-4 h-4" /> Encaisser un règlement</button>
          </>
        }
      >
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Kpi label="Solde d'ouverture" value={formaterFcfa(client.solde_initial)} />
            <Kpi label="Cumul factures" value={formaterFcfa(client.cumul_factures)} />
            <Kpi label="Cumul règlements" value={formaterFcfa(client.cumul_reglements)} tone="text-green-700" />
            <Kpi label="Créance actuelle" value={formaterFcfa(client.solde_actuel)} tone={client.solde_actuel > 0 ? 'text-red-600' : 'text-green-700'} />
            <Kpi label="Crédit disponible" value={formaterFcfa(disponibiliteCredit(client))} tone="text-blue-700" />
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statut.cls}`}>{statut.label}</span>
            <span className="text-neutral-500">Plafond : <span className="font-mono">{formaterFcfa(client.plafond_credit)}</span></span>
            {client.adresse && <span className="text-neutral-500">· {client.adresse}</span>}
            {client.contact && <span className="text-neutral-500">· Contact : {client.contact}</span>}
          </div>

          <section>
            <h4 className="text-sm font-semibold text-neutral-800 mb-2">Règlements ({reglements.length})</h4>
            {reglements.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucun règlement.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr><th className="px-3 py-2 text-left">Numéro</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Mode</th><th className="px-3 py-2 text-left">Caisse</th><th className="px-3 py-2 text-left">Référence</th><th className="px-3 py-2 text-left">Par</th><th className="px-3 py-2 text-right">Montant</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reglements.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono">{r.numero}</td>
                      <td className="px-3 py-2">{formaterDate(r.date_reglement)}</td>
                      <td className="px-3 py-2">{LIBELLES_TYPE_REGLEMENT[r.type_reglement]}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.caisse_nom ?? '—'}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.reference ?? '—'}</td>
                      <td className="px-3 py-2 text-neutral-600">{r.utilisateur || '—'}</td>
                      <td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(r.montant)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
          <p className="text-xs text-neutral-400">L'historique des ventes et factures apparaîtra ici avec le module Point de vente.</p>
        </div>
      </Modal>

      {modal === 'modifier' && <ClientFormModal filialeId={filialeId} client={client} onClose={() => setModal(null)} />}
      {modal === 'reglement' && <ReglementModal filialeId={filialeId} client={client} onClose={() => setModal(null)} />}
    </>
  );
}
