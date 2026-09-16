import { useState } from 'react';
import { useClientsStore } from '../../stores/clients.store';
import { XMarkIcon, PlusIcon, UserIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline';

interface ClientSelectorProps {
  onClose: () => void;
}

export default function ClientSelector({ onClose }: ClientSelectorProps) {
  const { clients, selectedClient, isComptoir, setSelectedClient, setIsComptoir, addClient, searchClients } = useClientsStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newClient, setNewClient] = useState({
    raison_sociale: '',
    mobile: '',
    adresse: '',
    plafond_credit: 0,
  });

  const filteredClients = searchQuery ? searchClients(searchQuery) : clients;

  const handleAddClient = () => {
    if (newClient.raison_sociale && newClient.mobile) {
      addClient({ ...newClient, solde_initial: 0 });
      setShowAddForm(false);
      setNewClient({ raison_sociale: '', mobile: '', adresse: '', plafond_credit: 0 });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-200">
          <h3 className="text-lg font-bold text-neutral-900">Sélectionner un client</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Contenu */}
        <div className="flex-1 overflow-y-auto p-6">
          {!showAddForm ? (
            <>
              {/* Bouton Comptoir */}
              <button
                onClick={() => { setIsComptoir(true); onClose(); }}
                className={`w-full p-4 rounded-lg border-2 mb-4 flex items-center gap-3 transition-colors ${
                  isComptoir ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'
                }`}
              >
                <UserIcon className="w-6 h-6 text-primary-600" />
                <div className="text-left">
                  <p className="font-semibold text-neutral-900">Client Comptoir</p>
                  <p className="text-sm text-neutral-500">Client anonyme, pas de crédit</p>
                </div>
              </button>

              {/* Recherche */}
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher un client..."
                className="w-full px-4 py-3 border border-neutral-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />

              {/* Liste des clients */}
              <div className="space-y-2">
                {filteredClients.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => { setSelectedClient(client); onClose(); }}
                    className={`w-full p-4 rounded-lg border-2 flex items-center gap-3 transition-colors ${
                      selectedClient?.id === client.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'
                    }`}
                  >
                    <BuildingOfficeIcon className="w-6 h-6 text-primary-600" />
                    <div className="text-left flex-1">
                      <p className="font-semibold text-neutral-900">{client.raison_sociale}</p>
                      <p className="text-sm text-neutral-500">{client.code} • {client.mobile}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-neutral-500">Solde</p>
                      <p className={`font-bold font-mono ${client.solde_actuel > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {client.solde_actuel.toLocaleString('fr-FR')} F
                      </p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Bouton Ajouter */}
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full mt-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <PlusIcon className="w-5 h-5" />
                Ajouter un nouveau client
              </button>
            </>
          ) : (
            /* Formulaire d'ajout */
            <div className="space-y-4">
              <h4 className="font-semibold text-neutral-900">Nouveau client</h4>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Raison sociale *</label>
                <input
                  type="text"
                  value={newClient.raison_sociale}
                  onChange={(e) => setNewClient({ ...newClient, raison_sociale: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Nom de l'entreprise ou du client"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Téléphone *</label>
                <input
                  type="text"
                  value={newClient.mobile}
                  onChange={(e) => setNewClient({ ...newClient, mobile: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="07 08 09 10 11"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Adresse</label>
                <input
                  type="text"
                  value={newClient.adresse}
                  onChange={(e) => setNewClient({ ...newClient, adresse: e.target.value })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="Adresse complète"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Plafond de crédit (FCFA)</label>
                <input
                  type="number"
                  value={newClient.plafond_credit}
                  onChange={(e) => setNewClient({ ...newClient, plafond_credit: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"
                >
                  Annuler
                </button>
                <button
                  onClick={handleAddClient}
                  className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"
                >
                  Enregistrer
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
