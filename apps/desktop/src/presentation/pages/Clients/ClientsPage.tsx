import { useState } from 'react';
import { BanknotesIcon, EyeIcon, MagnifyingGlassIcon, PlusIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { statutCredit, disponibiliteCredit, type Client } from '../../../core/clients';
import { ClientsRepository } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import ClientDetailsModal, { STATUT_CREDIT_STYLE } from '../../features/clients/ClientDetailsModal';
import ClientFormModal from '../../features/clients/ClientFormModal';
import ReglementModal from '../../features/clients/ReglementModal';
import { useClients } from '../../features/clients/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useConfirmation } from '../../confirmation/useConfirmation';

type ModalState = { type: 'creer' } | { type: 'details'; clientId: string } | { type: 'reglement'; client: Client } | null;

/** Clients de la filiale : situation de compte, encaissements, fiches. */
export default function ClientsPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const repository = useRepository(ClientsRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const [recherche, setRecherche] = useState('');
  const [avecCreance, setAvecCreance] = useState(false);
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const { clients, isLoading } = useClients(filialeId, { recherche, avecCreance, inclureInactifs });

  const totalCreances = clients.reduce((s, c) => s + Math.max(c.solde_actuel, 0), 0);
  const totalAvoirs = clients.reduce((s, c) => s + Math.max(-c.solde_actuel, 0), 0);
  const depassements = clients.filter((c) => statutCredit(c) === 'DEPASSE').length;

  const basculerActif = async (client: Client) => {
    if (client.est_actif && client.solde_actuel !== 0) { notifier('erreur', 'Impossible de désactiver un client dont le compte n\'est pas soldé.'); return; }
    if (!(await confirmer({ message: `${client.est_actif ? 'Désactiver' : 'Réactiver'} le client ${client.raison_sociale} ?`, libelleConfirmer: client.est_actif ? 'Désactiver' : 'Réactiver', danger: client.est_actif }))) return;
    try {
      await repository.setActif(client.id, !client.est_actif);
      notifier('succes', `Client ${client.raison_sociale} ${client.est_actif ? 'désactivé' : 'réactivé'}.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  if (!filialeId) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
        {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clients</h1>
          <p className="text-sm text-neutral-500 mt-1">{filiale?.nom} · {clients.length} client(s)</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer</button>
          <button onClick={() => setModal({ type: 'creer' })} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Nouveau client</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Créances clients</p><p className="text-2xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(totalCreances)}</p></div>
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Avoirs (acomptes)</p><p className="text-2xl font-bold font-mono text-blue-700 mt-1">{formaterFcfa(totalAvoirs)}</p></div>
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Plafonds dépassés</p><p className={`text-2xl font-bold mt-1 ${depassements ? 'text-red-600' : 'text-neutral-900'}`}>{depassements}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative flex-1 min-w-[16rem] max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Code, raison sociale ou mobile…" className={`${inputClass} pl-10`} />
        </div>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={avecCreance} onChange={(e) => setAvecCreance(e.target.checked)} className="rounded" /> Avec créance</label>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={inclureInactifs} onChange={(e) => setInclureInactifs(e.target.checked)} className="rounded" /> Inclure les inactifs</label>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Raison sociale</th><th className="px-4 py-3 text-left">Mobile</th>
                <th className="px-4 py-3 text-right">Factures</th><th className="px-4 py-3 text-right">Règlements</th><th className="px-4 py-3 text-right">Créance</th>
                <th className="px-4 py-3 text-right">Disponible</th><th className="px-4 py-3 text-center">Statut</th><th className="px-4 py-3 text-center print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {clients.map((c) => {
                const st = STATUT_CREDIT_STYLE[statutCredit(c)];
                return (
                  <tr key={c.id} className={`hover:bg-neutral-50 ${!c.est_actif ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 text-sm font-mono text-primary-700">{c.code}</td>
                    <td className="px-4 py-3 text-sm font-medium text-neutral-900">{c.raison_sociale}{!c.est_actif && <span className="ml-2 text-xs text-neutral-500">(inactif)</span>}</td>
                    <td className="px-4 py-3 text-sm text-neutral-600">{c.mobile ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{formaterFcfa(c.cumul_factures)}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-green-700">{formaterFcfa(c.cumul_reglements)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-mono font-bold ${c.solde_actuel > 0 ? 'text-red-600' : c.solde_actuel < 0 ? 'text-blue-700' : 'text-green-700'}`}>{formaterFcfa(c.solde_actuel)}</td>
                    <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{formaterFcfa(disponibiliteCredit(c))}</td>
                    <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span></td>
                    <td className="px-4 py-3 text-center print:hidden">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => setModal({ type: 'details', clientId: c.id })} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Fiche client"><EyeIcon className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ type: 'reglement', client: c })} className="p-1.5 hover:bg-green-50 rounded text-green-700" title="Encaisser un règlement"><BanknotesIcon className="w-4 h-4" /></button>
                        <button onClick={() => basculerActif(c)} className={`px-2 py-1 rounded text-xs font-medium ${c.est_actif ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>{c.est_actif ? 'Désactiver' : 'Réactiver'}</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && clients.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun client{recherche || avecCreance ? ' pour ces filtres' : ''}.</div>}
      </div>

      {modal?.type === 'creer' && <ClientFormModal filialeId={filialeId} onClose={() => setModal(null)} />}
      {modal?.type === 'details' && <ClientDetailsModal filialeId={filialeId} clientId={modal.clientId} onClose={() => setModal(null)} />}
      {modal?.type === 'reglement' && <ReglementModal filialeId={filialeId} client={modal.client} onClose={() => setModal(null)} />}
    </div>
  );
}
