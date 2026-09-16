import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useClientsStore } from '../../stores/clients.store';
import { 
  PlusIcon, MagnifyingGlassIcon, XMarkIcon, PrinterIcon,
  DocumentTextIcon, ShoppingCartIcon, BellIcon, EyeIcon,
  CheckCircleIcon, ClockIcon, XCircleIcon, PaperAirplaneIcon,
  CreditCardIcon, BuildingLibraryIcon, UserPlusIcon, EllipsisVerticalIcon
} from '@heroicons/react/24/outline';

interface Caisse {
  id: string;
  nom: string;
  responsable: string;
}

const CAISSES_MOCK: Caisse[] = [
  { id: '1', nom: 'Caisse Principale', responsable: 'Mme. Koné' },
  { id: '2', nom: 'Caisse Secondaire', responsable: 'M. Traoré' },
  { id: '3', nom: 'Caisse Livraison', responsable: 'M. Diabaté' },
];

export default function ClientsPage() {
  const store = useClientsStore();
  const clients = store.getClientsFiltres();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showFactureModal, setShowFactureModal] = useState(false);
  const [showReglementModal, setShowReglementModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRelanceModal, setShowRelanceModal] = useState(false);
  const [showRapportModal, setShowRapportModal] = useState(false);
  const [showApprovisionnementModal, setShowApprovisionnementModal] = useState(false);
  const [nouveauClient, setNouveauClient] = useState({
    raison_sociale: '', mobile: '', email: '', adresse: '',
    contact: '', solde_initial: 0, plafond_credit: 0,
  });

  const totalSolde = clients.reduce((sum, c) => sum + c.solde_actuel, 0);
  const totalFactures = clients.reduce((sum, c) => sum + c.cumul_factures, 0);
  const totalReglements = clients.reduce((sum, c) => sum + c.cumul_reglements, 0);

  const handleAddClient = () => {
    if (nouveauClient.raison_sociale && nouveauClient.mobile) {
      store.addClient(nouveauClient);
      setShowAddForm(false);
      setNouveauClient({
        raison_sociale: '', mobile: '', email: '', adresse: '',
        contact: '', solde_initial: 0, plafond_credit: 0,
      });
      alert('✅ Client créé avec succès !');
    }
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Clients</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestion des clients, factures et règlements • {clients.length} clients
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
            <PrinterIcon className="w-5 h-5" /> Imprimer
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
            <PlusIcon className="w-5 h-5" /> Nouveau Client
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Total clients</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{clients.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Cumul factures</p>
          <p className="text-2xl font-bold text-primary-700 font-mono mt-2">{totalFactures.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Cumul règlements</p>
          <p className="text-2xl font-bold text-green-600 font-mono mt-2">{totalReglements.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Solde global dû</p>
          <p className={`text-2xl font-bold font-mono mt-2 ${totalSolde > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalSolde.toLocaleString('fr-FR')} F
          </p>
        </div>
      </div>

      {/* Recherche */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm print:hidden">
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input
            type="text"
            value={store.recherche}
            onChange={(e) => store.setRecherche(e.target.value)}
            placeholder="Rechercher par code, raison sociale ou mobile..."
            className="w-full pl-12 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* Tableau Clients */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="hidden print:block px-6 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Répertoire des Clients</h2>
          <p className="text-sm text-neutral-600 mt-1">{clients.length} clients</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Raison Sociale</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Mobile</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Adresse</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Solde Initial</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Facture</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Règlement</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Solde</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Disponibilité</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Plafond</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-600 uppercase print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {clients.map((client) => (
                <tr key={client.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-primary-700">{client.code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{client.raison_sociale}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{client.mobile}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{client.adresse}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{client.solde_initial.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{client.cumul_factures.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-green-600">{client.cumul_reglements.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold font-mono">
                    <span className={client.solde_actuel > 0 ? 'text-red-600' : 'text-green-600'}>
                      {client.solde_actuel.toLocaleString('fr-FR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-blue-600">{client.disponibilite.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{client.plafond_credit.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-center print:hidden">
                    <DropdownActions
                      client={client}
                      onDetails={() => { store.setClientSelectionne(client); setShowDetailsModal(true); }}
                      onFacture={() => { store.setClientSelectionne(client); setShowFactureModal(true); }}
                      onReglement={() => { store.setClientSelectionne(client); setShowReglementModal(true); }}
                      onApprovisionnement={() => { store.setClientSelectionne(client); setShowApprovisionnementModal(true); }}
                      onRelance={() => { store.setClientSelectionne(client); setShowRelanceModal(true); }}
                      onRapport={() => { store.setClientSelectionne(client); setShowRapportModal(true); }}
                      onDelete={() => {
                        if (confirm(`⚠️ Supprimer le client "${client.raison_sociale}" ?`)) {
                          store.deleteClient(client.id);
                        }
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-neutral-50 border-t border-neutral-200 font-semibold">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm text-right text-neutral-700">TOTAUX :</td>
                <td className="px-4 py-3 text-sm text-right font-mono text-neutral-700">
                  {clients.reduce((s, c) => s + c.solde_initial, 0).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-neutral-700">{totalFactures.toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 text-sm text-right font-mono text-green-700">{totalReglements.toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">
                  <span className={totalSolde > 0 ? 'text-red-600' : 'text-green-600'}>{totalSolde.toLocaleString('fr-FR')}</span>
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-blue-700">
                  {clients.reduce((s, c) => s + c.disponibilite, 0).toLocaleString('fr-FR')}
                </td>
                <td></td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Modal Détails Client */}
      {showDetailsModal && store.clientSelectionne && (
        <ModalDetailsClient
          client={store.clientSelectionne}
          onClose={() => setShowDetailsModal(false)}
          store={store}
          onRelance={() => { setShowDetailsModal(false); setShowRelanceModal(true); }}
        />
      )}

      {/* Modal Création Facture */}
      {showFactureModal && store.clientSelectionne && (
        <ModalFacture
          client={store.clientSelectionne}
          onClose={() => setShowFactureModal(false)}
          store={store}
        />
      )}

      {/* Modal Règlement */}
      {showReglementModal && store.clientSelectionne && (
        <ModalReglement
          client={store.clientSelectionne}
          onClose={() => setShowReglementModal(false)}
          store={store}
          caisses={CAISSES_MOCK}
        />
      )}

      {/* Modal Approvisionnement */}
      {showApprovisionnementModal && store.clientSelectionne && (
        <ModalApprovisionnement
          client={store.clientSelectionne}
          onClose={() => setShowApprovisionnementModal(false)}
          store={store}
          caisses={CAISSES_MOCK}
        />
      )}

      {/* Modal Relance */}
      {showRelanceModal && store.clientSelectionne && (
        <ModalRelance
          client={store.clientSelectionne}
          onClose={() => setShowRelanceModal(false)}
          store={store}
        />
      )}

      {/* Modal Rapport */}
      {showRapportModal && store.clientSelectionne && (
        <ModalRapport
          client={store.clientSelectionne}
          onClose={() => setShowRapportModal(false)}
          store={store}
        />
      )}

      {/* Modal Nouveau Client */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouveau Client</h3>
              <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Raison sociale *</label>
                  <input type="text" value={nouveauClient.raison_sociale} onChange={(e) => setNouveauClient({...nouveauClient, raison_sociale: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Mobile *</label>
                  <input type="text" value={nouveauClient.mobile} onChange={(e) => setNouveauClient({...nouveauClient, mobile: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
                  <input type="email" value={nouveauClient.email} onChange={(e) => setNouveauClient({...nouveauClient, email: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Contact</label>
                  <input type="text" value={nouveauClient.contact} onChange={(e) => setNouveauClient({...nouveauClient, contact: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Adresse</label>
                <input type="text" value={nouveauClient.adresse} onChange={(e) => setNouveauClient({...nouveauClient, adresse: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Solde initial</label>
                  <input type="number" value={nouveauClient.solde_initial} onChange={(e) => setNouveauClient({...nouveauClient, solde_initial: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Plafond crédit</label>
                  <input type="number" value={nouveauClient.plafond_credit} onChange={(e) => setNouveauClient({...nouveauClient, plafond_credit: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddForm(false)} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
                <button onClick={handleAddClient} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:p-0, .print\\:p-0 * { visibility: visible; }
          .print\\:p-0 { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
        }
      `}</style>
    </div>
  );
}

// ============ DROPDOWN ACTIONS ============
function DropdownActions({ client, onDetails, onFacture, onReglement, onApprovisionnement, onRelance, onRapport, onDelete }: any) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      if (dropdownRef.current) {
        const rect = dropdownRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          right: window.innerWidth - rect.right + window.scrollX,
        });
      }
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  const hasEmail = client.email && client.email.trim() !== '';
  const hasSoldeImpaye = client.solde_actuel > 0;

  const dropdownContent = (
    <div
      className="fixed bg-white rounded-lg shadow-xl border border-neutral-200 z-[100] py-1 w-60"
      style={{ top: `${position.top}px`, right: `${position.right}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={() => { onDetails(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <EyeIcon className="w-4 h-4 text-blue-600" /><span>Voir détails client</span>
      </button>
      <button onClick={() => { onFacture(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <DocumentTextIcon className="w-4 h-4 text-green-600" /><span>Créer facture / devis</span>
      </button>
      <button onClick={() => { onReglement(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <CreditCardIcon className="w-4 h-4 text-orange-600" /><span>Enregistrer règlement</span>
      </button>
      <button onClick={() => { onApprovisionnement(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <BuildingLibraryIcon className="w-4 h-4 text-blue-600" /><span>Approvisionner compte</span>
      </button>
      <button onClick={() => { onRelance(); setIsOpen(false); }}
        disabled={!hasEmail || !hasSoldeImpaye}
        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 border-b border-neutral-100 ${
          !hasEmail || !hasSoldeImpaye ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-700 hover:bg-neutral-50'
        }`}
        title={!hasEmail ? 'Client sans email' : !hasSoldeImpaye ? 'Aucun solde impayé' : 'Envoyer relance'}>
        <BellIcon className="w-4 h-4 text-orange-600" /><span>Relance email</span>
        {(!hasEmail || !hasSoldeImpaye) && <span className="ml-auto text-xs text-neutral-400">N/A</span>}
      </button>
      <button onClick={() => { onRapport(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <PrinterIcon className="w-4 h-4 text-purple-600" /><span>Rapport client</span>
      </button>
      <button onClick={() => { onDelete(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-3 text-red-600">
        <XCircleIcon className="w-4 h-4" /><span>Supprimer client</span>
      </button>
    </div>
  );

  return (
    <div className="relative" ref={dropdownRef}>
      <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors" title="Actions">
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
}

// ============ MODAL RÈGLEMENT (avec sélection de caisse) ============
function ModalReglement({ client, onClose, store, caisses }: any) {
  const [montant, setMontant] = useState(0);
  const [type_reglement, setTypeReglement] = useState('ESPECES');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [caisseId, setCaisseId] = useState('');

  const validerReglement = () => {
    if (montant > 0 && caisseId) {
      store.addReglement({
        client_id: client.id,
        montant,
        type_reglement,
        date,
        reference,
        caisse_id: caisseId,
      });
      alert(`✅ Règlement de ${montant.toLocaleString('fr-FR')} F enregistré dans ${caisses.find((c: any) => c.id === caisseId)?.nom}`);
      onClose();
    } else if (!caisseId) {
      alert('⚠️ Veuillez sélectionner une caisse');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Enregistrer un règlement</h3>
        <div className="bg-red-50 p-3 rounded-lg mb-4">
          <p className="text-sm text-red-700">Client: <strong>{client.raison_sociale}</strong></p>
          <p className="text-sm text-red-700">Dette actuelle: <strong>{client.solde_actuel.toLocaleString('fr-FR')} F</strong></p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Caisse *</label>
            <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">-- Sélectionner une caisse --</option>
              {caisses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom} ({c.responsable})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Date de règlement *</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Montant (FCFA) *</label>
            <input type="number" value={montant} onChange={(e) => setMontant(Number(e.target.value))}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Type de règlement</label>
            <select value={type_reglement} onChange={(e) => setTypeReglement(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
              <option>ESPECES</option>
              <option>CHEQUE</option>
              <option>VIREMENT</option>
              <option>MOBILE_MONEY</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Référence</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="N° chèque, virement..." className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
            <button onClick={validerReglement} className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg">Valider</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MODAL APPROVISIONNEMENT (avec sélection de caisse) ============
function ModalApprovisionnement({ client, onClose, store, caisses }: any) {
  const [montant, setMontant] = useState(0);
  const [motif, setMotif] = useState('Apport en caisse');
  const [caisseId, setCaisseId] = useState('');

  const validerApprovisionnement = () => {
    if (montant > 0 && caisseId) {
      store.updateClient(client.id, {
        disponibilite: client.disponibilite + montant,
        plafond_credit: client.plafond_credit + montant,
      });
      const caisseNom = caisses.find((c: any) => c.id === caisseId)?.nom;
      alert(`✅ Compte approvisionné de ${montant.toLocaleString('fr-FR')} FCFA dans ${caisseNom}`);
      onClose();
    } else if (!caisseId) {
      alert('️ Veuillez sélectionner une caisse');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Approvisionner le compte client</h3>
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <p className="text-sm text-blue-700">Client: <strong>{client.raison_sociale}</strong></p>
          <p className="text-sm text-blue-700">Disponibilité actuelle: <strong>{client.disponibilite.toLocaleString('fr-FR')} F</strong></p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Caisse *</label>
            <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Sélectionner une caisse --</option>
              {caisses.map((c: any) => (
                <option key={c.id} value={c.id}>{c.nom} ({c.responsable})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Montant à ajouter (FCFA)</label>
            <input type="number" value={montant} onChange={(e) => setMontant(Number(e.target.value))}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Motif</label>
            <select value={motif} onChange={(e) => setMotif(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
              <option>Apport en caisse</option>
              <option>Augmentation plafond crédit</option>
              <option>Dépôt de garantie</option>
              <option>Autre</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
            <button onClick={validerApprovisionnement} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">Approvisionner</button>
          </div>
        </div>
      </div>
    </div>
  );
}
