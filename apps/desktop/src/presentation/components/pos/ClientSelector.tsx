import { useState } from 'react';
import { BuildingOfficeIcon, PlusIcon, UserIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { statutCredit, type Client } from '../../../core/clients';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import ClientFormModal from '../../features/clients/ClientFormModal';
import { STATUT_CREDIT_STYLE } from '../../features/clients/ClientDetailsModal';
import { useClients } from '../../features/clients/hooks';
import { formaterFcfa } from '../../hooks/useFormatage';
import { usePOSStore } from '../../stores/pos.store';

interface ClientSelectorProps {
  onClose: () => void;
}

/** Choix du client du ticket : comptoir (anonyme) ou client en compte, avec création rapide. */
export default function ClientSelector({ onClose }: ClientSelectorProps) {
  const { filialeId } = useFilialeCourante();
  const { client: selectedClient, setClient } = usePOSStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const { clients } = useClients(filialeId, { recherche: searchQuery });

  const choisir = (client: Client | null) => { setClient(client); onClose(); };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h3 className="text-lg font-bold text-neutral-900">Sélectionner un client</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <button
            onClick={() => choisir(null)}
            className={`w-full p-4 rounded-lg border-2 mb-4 flex items-center gap-3 transition-colors ${selectedClient === null ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'}`}
          >
            <UserIcon className="w-6 h-6 text-primary-600" />
            <div className="text-left">
              <p className="font-semibold text-neutral-900">Client comptoir</p>
              <p className="text-sm text-neutral-500">Client anonyme, paiement immédiat</p>
            </div>
          </button>

          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un client (code, nom, mobile)…"
            autoFocus
            className="w-full px-4 py-3 border border-neutral-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />

          <div className="space-y-2">
            {clients.map((client) => {
              const st = STATUT_CREDIT_STYLE[statutCredit(client)];
              return (
                <button
                  key={client.id}
                  onClick={() => choisir(client)}
                  className={`w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${selectedClient?.id === client.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'}`}
                >
                  <BuildingOfficeIcon className="w-6 h-6 text-primary-600" />
                  <div className="text-left flex-1">
                    <p className="font-semibold text-neutral-900">{client.raison_sociale}</p>
                    <p className="text-sm text-neutral-500">{client.code} • {client.mobile || '—'}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-500">Créance</p>
                    <p className={`font-bold font-mono ${client.solde_actuel > 0 ? 'text-red-600' : 'text-green-600'}`}>{formaterFcfa(client.solde_actuel)}</p>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>{st.label}</span>
                  </div>
                </button>
              );
            })}
            {clients.length === 0 && <p className="text-sm text-neutral-400 text-center py-4">Aucun client{searchQuery ? ' pour cette recherche' : ''}.</p>}
          </div>

          <button onClick={() => setShowAddForm(true)} className="w-full mt-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg flex items-center justify-center gap-2">
            <PlusIcon className="w-5 h-5" /> Ajouter un nouveau client
          </button>
        </div>
      </div>

      {showAddForm && filialeId && (
        <ClientFormModal
          filialeId={filialeId}
          onClose={() => setShowAddForm(false)}
          onCreated={() => setSearchQuery('')}
        />
      )}
    </div>
  );
}
