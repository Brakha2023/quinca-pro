import { BellIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useClientsStore, type Client, type Facture } from '../../stores/clients.store';

interface Props {
  client: Client;
  onClose: () => void;
}

const STATUT_STYLES: Record<Facture['statut'], string> = {
  DEVIS: 'bg-neutral-100 text-neutral-700',
  FACTURE: 'bg-orange-100 text-orange-700',
  PAYEE: 'bg-green-100 text-green-700',
  ANNULEE: 'bg-red-100 text-red-700',
};

/** Fiche client : informations, factures et règlements, relance des impayés. */
export default function ModalDetailsClient({ client, onClose }: Props) {
  const factures = useClientsStore((s) => s.getFacturesByClient(client.id));
  const reglements = useClientsStore((s) => s.getReglementsByClient(client.id));
  const sendRelance = useClientsStore((s) => s.sendRelance);

  const peutRelancer = Boolean(client.email) && client.solde_actuel > 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">{client.raison_sociale}</h3>
            <p className="text-sm text-neutral-500">
              {client.code} • {client.mobile || 'Sans mobile'} • {client.email || 'Sans email'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Solde initial" value={client.solde_initial} />
            <Kpi label="Cumul factures" value={client.cumul_factures} />
            <Kpi label="Cumul règlements" value={client.cumul_reglements} tone="text-green-700" />
            <Kpi label="Solde actuel" value={client.solde_actuel} tone={client.solde_actuel > 0 ? 'text-red-600' : 'text-green-700'} />
          </div>

          <section>
            <h4 className="text-sm font-semibold text-neutral-800 mb-2">Factures ({factures.length})</h4>
            {factures.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucune facture.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Numéro</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Statut</th>
                    <th className="px-3 py-2 text-right">Total TTC</th>
                    <th className="px-3 py-2 text-right">Reste à payer</th>
                    <th className="px-3 py-2 text-center">Relance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {factures.map((f) => (
                    <tr key={f.id}>
                      <td className="px-3 py-2 font-mono">{f.numero}</td>
                      <td className="px-3 py-2">{f.date} {f.heure}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLES[f.statut]}`}>{f.statut}</span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{f.total_ttc.toLocaleString('fr-FR')}</td>
                      <td className={`px-3 py-2 text-right font-mono ${f.reste_a_payer > 0 ? 'text-red-600' : ''}`}>
                        {f.reste_a_payer.toLocaleString('fr-FR')}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => sendRelance(client.id, f.id)}
                          disabled={!peutRelancer || f.reste_a_payer <= 0}
                          title={!client.email ? 'Client sans email' : f.reste_a_payer <= 0 ? 'Facture soldée' : 'Envoyer une relance'}
                          className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-50 disabled:text-neutral-300 disabled:hover:bg-transparent"
                        >
                          <BellIcon className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section>
            <h4 className="text-sm font-semibold text-neutral-800 mb-2">Règlements ({reglements.length})</h4>
            {reglements.length === 0 ? (
              <p className="text-sm text-neutral-400">Aucun règlement.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Numéro</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {reglements.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 font-mono">{r.numero}</td>
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2">{r.type_reglement}</td>
                      <td className="px-3 py-2 text-right font-mono text-green-700">{r.montant.toLocaleString('fr-FR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone = 'text-neutral-900' }: { label: string; value: number; tone?: string }) {
  return (
    <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className={`text-lg font-bold font-mono ${tone}`}>{value.toLocaleString('fr-FR')} F</p>
    </div>
  );
}
