import { useState, useRef, useEffect, createPortal } from 'react';
import { create } from 'zustand';
import { 
  PlusIcon, MagnifyingGlassIcon, XMarkIcon, PrinterIcon,
  EllipsisVerticalIcon, EyeIcon, DocumentTextIcon,
  CreditCardIcon, ShoppingCartIcon, BellIcon,
  XCircleIcon, PaperAirplaneIcon, TruckIcon
} from '@heroicons/react/24/outline';

// ============ TYPES ============
export type StatutCommande = 'BROUILLON' | 'ENVOYEE' | 'PARTIELLE' | 'LIVREE' | 'ANNULEE';
export type TypeReglement = 'ESPECES' | 'CHEQUE' | 'VIREMENT' | 'MOBILE_MONEY';

export interface Fournisseur {
  id: string;
  code: string;
  numero_compte: string;
  raison_sociale: string;
  famille: string;
  type_article: string;
  telephone: string;
  email?: string;
  adresse: string;
  solde_initial: number;
  cumul_factures: number;
  cumul_reglements: number;
  solde_actuel: number;
  plafond_credit: number;
  est_actif: boolean;
  date_creation: string;
}

export interface CommandeFournisseur {
  id: string;
  numero: string;
  fournisseur_id: string;
  date: string;
  heure: string;
  type: 'COMMANDE' | 'BON_COMMANDE';
  statut: StatutCommande;
  lignes: LigneCommande[];
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  reste_a_payer: number;
  montant_paye: number;
  date_livraison_prevue?: string;
  notes?: string;
}

export interface LigneCommande {
  code_ref: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  remise: number;
  total_ht: number;
  tva: number;
}

export interface ReglementFournisseur {
  id: string;
  numero: string;
  fournisseur_id: string;
  date: string;
  montant: number;
  type_reglement: TypeReglement;
  commande_id?: string;
  reference?: string;
  caisse_id?: string;
}

export interface Caisse {
  id: string;
  nom: string;
  responsable: string;
}

// ============ STORE ============
interface FournisseursState {
  fournisseurs: Fournisseur[];
  commandes: CommandeFournisseur[];
  reglements: ReglementFournisseur[];
  fournisseurSelectionne: Fournisseur | null;
  recherche: string;
  familleFiltre: string;

  setFournisseurSelectionne: (f: Fournisseur | null) => void;
  setRecherche: (query: string) => void;
  setFamilleFiltre: (famille: string) => void;
  addFournisseur: (data: Omit<Fournisseur, 'id' | 'code' | 'cumul_factures' | 'cumul_reglements' | 'solde_actuel' | 'date_creation'>) => void;
  updateFournisseur: (id: string, data: Partial<Fournisseur>) => void;
  deleteFournisseur: (id: string) => void;
  getFournisseursFiltres: () => Fournisseur[];

  createCommande: (data: Omit<CommandeFournisseur, 'id' | 'numero'>) => void;
  updateCommandeStatut: (commandeId: string, statut: StatutCommande) => void;
  getCommandesByFournisseur: (fournisseurId: string) => CommandeFournisseur[];

  addReglement: (data: Omit<ReglementFournisseur, 'id' | 'numero'>) => void;
  getReglementsByFournisseur: (fournisseurId: string) => ReglementFournisseur[];

  sendRelance: (fournisseur_id: string, commande_id: string) => void;
}

const FOURNISSEURS_MOCK: Fournisseur[] = [
  {
    id: '1', code: 'FOU-001', numero_compte: '401001',
    raison_sociale: '3K IMPORT/EXPORT', famille: 'Import-Export',
    type_article: 'Quincaillerie générale',
    telephone: '27 21 25 70 81', email: 'contact@3kimport.ci',
    adresse: 'Zone portuaire, Abidjan',
    solde_initial: 0, cumul_factures: 5378201, cumul_reglements: 5378000,
    solde_actuel: 201, plafond_credit: 10000000,
    est_actif: true, date_creation: '2024-01-15',
  },
  {
    id: '2', code: 'FOU-002', numero_compte: '401002',
    raison_sociale: 'Ciments de l\'Afrique', famille: 'Ciment',
    type_article: 'Ciment, béton',
    telephone: '07 08 09 10 11', email: 'ventes@cimentsafrique.ci',
    adresse: 'Vridi, Abidjan',
    solde_initial: 0, cumul_factures: 15000000, cumul_reglements: 12500000,
    solde_actuel: 2500000, plafond_credit: 20000000,
    est_actif: true, date_creation: '2024-02-01',
  },
  {
    id: '3', code: 'FOU-003', numero_compte: '401003',
    raison_sociale: 'Plomberie Pro SARL', famille: 'Plomberie',
    type_article: 'Articles plomberie',
    telephone: '05 06 07 08 09', email: '',
    adresse: 'Treichville, Abidjan',
    solde_initial: 0, cumul_factures: 8500000, cumul_reglements: 8500000,
    solde_actuel: 0, plafond_credit: 10000000,
    est_actif: true, date_creation: '2024-03-10',
  },
  {
    id: '4', code: 'FOU-004', numero_compte: '401004',
    raison_sociale: 'Électricité Générale', famille: 'Électricité',
    type_article: 'Matériel électrique',
    telephone: '01 02 03 04 05', email: 'info@elecgenerale.ci',
    adresse: 'Adjamé, Abidjan',
    solde_initial: 0, cumul_factures: 12000000, cumul_reglements: 10200000,
    solde_actuel: 1800000, plafond_credit: 15000000,
    est_actif: true, date_creation: '2024-04-05',
  },
];

const COMMANDES_MOCK: CommandeFournisseur[] = [
  {
    id: '1', numero: 'CMD-2026-001', fournisseur_id: '2',
    date: '2026-08-20', heure: '09:30',
    type: 'COMMANDE', statut: 'LIVREE',
    lignes: [
      { code_ref: 'CIM50', designation: 'Ciment 50kg', quantite: 100, prix_unitaire_ht: 4500, remise: 0, total_ht: 450000, tva: 81000 },
    ],
    total_ht: 450000, total_tva: 81000, total_ttc: 531000,
    reste_a_payer: 0, montant_paye: 531000,
    date_livraison_prevue: '2026-08-25',
  },
  {
    id: '2', numero: 'CMD-2026-002', fournisseur_id: '4',
    date: '2026-08-25', heure: '14:00',
    type: 'COMMANDE', statut: 'ENVOYEE',
    lignes: [
      { code_ref: 'CAB25', designation: 'Câble 2.5mm² (rouleau 100m)', quantite: 20, prix_unitaire_ht: 15000, remise: 5, total_ht: 285000, tva: 51300 },
    ],
    total_ht: 285000, total_tva: 51300, total_ttc: 336300,
    reste_a_payer: 336300, montant_paye: 0,
    date_livraison_prevue: '2026-09-01',
  },
];

const CAISSES_MOCK: Caisse[] = [
  { id: '1', nom: 'Caisse Principale', responsable: 'Mme. Koné' },
  { id: '2', nom: 'Caisse Secondaire', responsable: 'M. Traoré' },
  { id: '3', nom: 'Caisse Livraison', responsable: 'M. Diabaté' },
];

export const useFournisseursStore = create<FournisseursState>((set, get) => ({
  fournisseurs: FOURNISSEURS_MOCK,
  commandes: COMMANDES_MOCK,
  reglements: [],
  fournisseurSelectionne: null,
  recherche: '',
  familleFiltre: 'Toutes',

  setFournisseurSelectionne: (f) => set({ fournisseurSelectionne: f }),
  setRecherche: (query) => set({ recherche: query }),
  setFamilleFiltre: (famille) => set({ familleFiltre: famille }),

  addFournisseur: (data) => {
    const newF: Fournisseur = {
      ...data,
      id: Date.now().toString(),
      code: `FOU-${String(get().fournisseurs.length + 1).padStart(3, '0')}`,
      cumul_factures: 0,
      cumul_reglements: 0,
      solde_actuel: data.solde_initial,
      date_creation: new Date().toISOString().split('T')[0],
    };
    set({ fournisseurs: [...get().fournisseurs, newF] });
  },

  updateFournisseur: (id, data) => {
    set({ fournisseurs: get().fournisseurs.map(f => f.id === id ? { ...f, ...data } : f) });
  },

  deleteFournisseur: (id) => {
    if (confirm('⚠️ Supprimer ce fournisseur ?')) {
      set({ fournisseurs: get().fournisseurs.filter(f => f.id !== id) });
    }
  },

  getFournisseursFiltres: () => {
    const { fournisseurs, recherche, familleFiltre } = get();
    return fournisseurs.filter(f => {
      const matchRecherche =
        f.raison_sociale.toLowerCase().includes(recherche.toLowerCase()) ||
        f.code.toLowerCase().includes(recherche.toLowerCase()) ||
        f.numero_compte.includes(recherche);
      const matchFamille = familleFiltre === 'Toutes' || f.famille === familleFiltre;
      return matchRecherche && matchFamille;
    });
  },

  createCommande: (data) => {
    const newCmd: CommandeFournisseur = {
      ...data,
      id: Date.now().toString(),
      numero: `CMD-${new Date().getFullYear()}-${String(get().commandes.length + 1).padStart(3, '0')}`,
    };
    set({ commandes: [...get().commandes, newCmd] });

    const f = get().fournisseurs.find(x => x.id === data.fournisseur_id);
    if (f) {
      get().updateFournisseur(f.id, {
        cumul_factures: f.cumul_factures + data.total_ttc,
        solde_actuel: f.solde_actuel + data.total_ttc,
      });
    }
  },

  updateCommandeStatut: (commandeId, statut) => {
    set({ commandes: get().commandes.map(c => c.id === commandeId ? { ...c, statut } : c) });
  },

  getCommandesByFournisseur: (fournisseurId) => {
    return get().commandes.filter(c => c.fournisseur_id === fournisseurId);
  },

  addReglement: (data) => {
    const newReg: ReglementFournisseur = {
      ...data,
      id: Date.now().toString(),
      numero: `REG-FOU-${Date.now()}`,
    };
    set({ reglements: [...get().reglements, newReg] });

    const f = get().fournisseurs.find(x => x.id === data.fournisseur_id);
    if (f) {
      get().updateFournisseur(f.id, {
        cumul_reglements: f.cumul_reglements + data.montant,
        solde_actuel: f.solde_actuel - data.montant,
      });
    }

    if (data.commande_id) {
      const cmd = get().commandes.find(c => c.id === data.commande_id);
      if (cmd) {
        const nouveauReste = Math.max(0, cmd.reste_a_payer - data.montant);
        const nouveauPaye = cmd.montant_paye + data.montant;
        const nouveauStatut = nouveauReste === 0 ? 'LIVREE' : 'PARTIELLE';
        set({
          commandes: get().commandes.map(c => c.id === data.commande_id ? {
            ...c, reste_a_payer: nouveauReste, montant_paye: nouveauPaye, statut: nouveauStatut as StatutCommande,
          } : c),
        });
      }
    }
  },

  getReglementsByFournisseur: (fournisseurId) => {
    return get().reglements.filter(r => r.fournisseur_id === fournisseurId);
  },

  sendRelance: (fournisseur_id, commande_id) => {
    const f = get().fournisseurs.find(x => x.id === fournisseur_id);
    const cmd = get().commandes.find(c => c.id === commande_id);
    if (f && cmd && f.email) {
      alert(`✅ Email de relance envoyé à ${f.email}\nCommande: ${cmd.numero}\nMontant dû: ${cmd.reste_a_payer.toLocaleString('fr-FR')} FCFA`);
    } else {
      alert('❌ Email non disponible pour ce fournisseur');
    }
  },
}));

// ============ PAGE PRINCIPALE ============
export default function FournisseursPage() {
  const store = useFournisseursStore();
  const fournisseurs = store.getFournisseursFiltres();
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCommandeModal, setShowCommandeModal] = useState(false);
  const [showReglementModal, setShowReglementModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showRelanceModal, setShowRelanceModal] = useState(false);
  const [showRapportModal, setShowRapportModal] = useState(false);
  const [showApprovisionnementModal, setShowApprovisionnementModal] = useState(false);
  const [nouveauFournisseur, setNouveauFournisseur] = useState({
    numero_compte: '', raison_sociale: '', famille: 'Matériaux',
    type_article: '', telephone: '', email: '', adresse: '',
    solde_initial: 0, plafond_credit: 0,
  });

  const totalSolde = fournisseurs.reduce((sum, f) => sum + f.solde_actuel, 0);
  const totalFactures = fournisseurs.reduce((sum, f) => sum + f.cumul_factures, 0);
  const totalReglements = fournisseurs.reduce((sum, f) => sum + f.cumul_reglements, 0);

  const handleAddFournisseur = () => {
    if (nouveauFournisseur.raison_sociale && nouveauFournisseur.numero_compte) {
      store.addFournisseur(nouveauFournisseur);
      setShowAddForm(false);
      setNouveauFournisseur({
        numero_compte: '', raison_sociale: '', famille: 'Matériaux',
        type_article: '', telephone: '', email: '', adresse: '',
        solde_initial: 0, plafond_credit: 0,
      });
      alert('✅ Fournisseur créé avec succès !');
    }
  };

  const handlePrint = () => window.print();

  const familles = ['Toutes', ...Array.from(new Set(fournisseurs.map(f => f.famille)))];

  return (
    <div className="space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Fournisseurs</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Gestion des fournisseurs, commandes et dettes • {fournisseurs.length} fournisseurs
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
            <PrinterIcon className="w-5 h-5" /> Imprimer
          </button>
          <button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
            <PlusIcon className="w-5 h-5" /> Nouveau Fournisseur
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Total fournisseurs</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{fournisseurs.length}</p>
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
          <p className="text-sm text-neutral-500">Dettes à régler</p>
          <p className={`text-2xl font-bold font-mono mt-2 ${totalSolde > 0 ? 'text-red-600' : 'text-green-600'}`}>
            {totalSolde.toLocaleString('fr-FR')} F
          </p>
        </div>
      </div>

      {/* Recherche & Filtres */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={store.recherche}
              onChange={(e) => store.setRecherche(e.target.value)}
              placeholder="Rechercher par compte, raison sociale ou téléphone..."
              className="w-full pl-12 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <select
            value={store.familleFiltre}
            onChange={(e) => store.setFamilleFiltre(e.target.value)}
            className="px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            {familles.map(f => <option key={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="hidden print:block px-6 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Liste des Fournisseurs</h2>
          <p className="text-sm text-neutral-600 mt-1">{fournisseurs.length} fournisseurs</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">N° Compte</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Raison Sociale</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Famille</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Type Article</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Téléphone</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Solde Initial</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Factures</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Règlements</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Solde</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-neutral-600 uppercase print:hidden">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {fournisseurs.map((f) => (
                <tr key={f.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono font-medium text-primary-700">{f.numero_compte}</td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{f.raison_sociale}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{f.famille}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{f.type_article}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{f.telephone}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{f.solde_initial.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{f.cumul_factures.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-green-600">{f.cumul_reglements.toLocaleString('fr-FR')}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold font-mono">
                    <span className={f.solde_actuel > 0 ? 'text-red-600' : 'text-green-600'}>
                      {f.solde_actuel.toLocaleString('fr-FR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center print:hidden">
                    <DropdownActions
                      fournisseur={f}
                      onDetails={() => { store.setFournisseurSelectionne(f); setShowDetailsModal(true); }}
                      onCommande={() => { store.setFournisseurSelectionne(f); setShowCommandeModal(true); }}
                      onReglement={() => { store.setFournisseurSelectionne(f); setShowReglementModal(true); }}
                      onApprovisionnement={() => { store.setFournisseurSelectionne(f); setShowApprovisionnementModal(true); }}
                      onRelance={() => { store.setFournisseurSelectionne(f); setShowRelanceModal(true); }}
                      onRapport={() => { store.setFournisseurSelectionne(f); setShowRapportModal(true); }}
                      onDelete={() => store.deleteFournisseur(f.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-neutral-50 border-t border-neutral-200 font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-3 text-sm text-right text-neutral-700">Somme :</td>
                <td className="px-4 py-3 text-sm text-right font-mono text-neutral-700">
                  {fournisseurs.reduce((s, f) => s + f.solde_initial, 0).toLocaleString('fr-FR')}
                </td>
                <td className="px-4 py-3 text-sm text-right font-mono text-neutral-700">{totalFactures.toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 text-sm text-right font-mono text-green-700">{totalReglements.toLocaleString('fr-FR')}</td>
                <td className="px-4 py-3 text-sm text-right font-mono">
                  <span className={totalSolde > 0 ? 'text-red-600' : 'text-green-600'}>{totalSolde.toLocaleString('fr-FR')}</span>
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ============ MODALS ============ */}

      {showDetailsModal && store.fournisseurSelectionne && (
        <ModalDetailsFournisseur
          fournisseur={store.fournisseurSelectionne}
          onClose={() => setShowDetailsModal(false)}
          store={store}
          onRelance={() => { setShowDetailsModal(false); setShowRelanceModal(true); }}
          onImprimerCommande={printCommande}
        />
      )}

      {showCommandeModal && store.fournisseurSelectionne && (
        <ModalCommande
          fournisseur={store.fournisseurSelectionne}
          onClose={() => setShowCommandeModal(false)}
          store={store}
        />
      )}

      {showReglementModal && store.fournisseurSelectionne && (
        <ModalReglement
          fournisseur={store.fournisseurSelectionne}
          onClose={() => setShowReglementModal(false)}
          store={store}
          caisses={CAISSES_MOCK}
        />
      )}

      {showApprovisionnementModal && store.fournisseurSelectionne && (
        <ModalApprovisionnement
          fournisseur={store.fournisseurSelectionne}
          onClose={() => setShowApprovisionnementModal(false)}
          store={store}
          caisses={CAISSES_MOCK}
        />
      )}

      {showRelanceModal && store.fournisseurSelectionne && (
        <ModalRelance
          fournisseur={store.fournisseurSelectionne}
          onClose={() => setShowRelanceModal(false)}
          store={store}
        />
      )}

      {showRapportModal && store.fournisseurSelectionne && (
        <ModalRapport
          fournisseur={store.fournisseurSelectionne}
          onClose={() => setShowRapportModal(false)}
          store={store}
        />
      )}

      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Nouveau Fournisseur</h3>
              <button onClick={() => setShowAddForm(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">N° Compte *</label>
                  <input type="text" value={nouveauFournisseur.numero_compte}
                    onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, numero_compte: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="401001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Famille</label>
                  <select value={nouveauFournisseur.famille}
                    onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, famille: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                    {['Matériaux','Sanitaire','Plomberie','Électricité','Outillage','Quincaillerie','Peinture','Import-Export','Ciment'].map(f => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Raison sociale *</label>
                <input type="text" value={nouveauFournisseur.raison_sociale}
                  onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, raison_sociale: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Type d'article fourni</label>
                <input type="text" value={nouveauFournisseur.type_article}
                  onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, type_article: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Ex: Articles sanitaires, Ciment..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Téléphone</label>
                  <input type="text" value={nouveauFournisseur.telephone}
                    onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, telephone: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Email</label>
                  <input type="email" value={nouveauFournisseur.email}
                    onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, email: e.target.value})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Adresse</label>
                <input type="text" value={nouveauFournisseur.adresse}
                  onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, adresse: e.target.value})}
                  className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Solde initial (FCFA)</label>
                  <input type="number" value={nouveauFournisseur.solde_initial}
                    onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, solde_initial: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Plafond crédit</label>
                  <input type="number" value={nouveauFournisseur.plafond_credit}
                    onChange={(e) => setNouveauFournisseur({...nouveauFournisseur, plafond_credit: Number(e.target.value)})}
                    className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddForm(false)} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
                <button onClick={handleAddFournisseur} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Enregistrer</button>
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

// ============ DROPDOWN ACTIONS (avec Portal) ============
function DropdownActions({
  fournisseur, onDetails, onCommande, onReglement, onApprovisionnement, onRelance, onRapport, onDelete
}: {
  fournisseur: any;
  onDetails: () => void;
  onCommande: () => void;
  onReglement: () => void;
  onApprovisionnement: () => void;
  onRelance: () => void;
  onRapport: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    const handleClickOutside = () => setIsOpen(false);
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPosition({
          top: rect.bottom + window.scrollY,
          right: window.innerWidth - rect.right + window.scrollX,
        });
      }
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [isOpen]);

  const hasEmail = fournisseur.email && fournisseur.email.trim() !== '';
  const hasDette = fournisseur.solde_actuel > 0;

  const dropdownContent = (
    <div
      className="fixed bg-white rounded-lg shadow-xl border border-neutral-200 z-[100] py-1 w-60"
      style={{ top: `${position.top}px`, right: `${position.right}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <button onClick={() => { onDetails(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <EyeIcon className="w-4 h-4 text-blue-600" /><span>Voir détails fournisseur</span>
      </button>
      <button onClick={() => { onCommande(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <DocumentTextIcon className="w-4 h-4 text-green-600" /><span>Créer commande</span>
      </button>
      <button onClick={() => { onReglement(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <CreditCardIcon className="w-4 h-4 text-orange-600" /><span>Enregistrer règlement</span>
      </button>
      <button onClick={() => { onApprovisionnement(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <ShoppingCartIcon className="w-4 h-4 text-blue-600" /><span>Augmenter plafond</span>
      </button>
      <button onClick={() => { onRelance(); setIsOpen(false); }}
        disabled={!hasEmail || !hasDette}
        className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 border-b border-neutral-100 ${
          !hasEmail || !hasDette ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-700 hover:bg-neutral-50'
        }`}
        title={!hasEmail ? 'Fournisseur sans email' : !hasDette ? 'Aucune dette' : 'Envoyer relance'}>
        <BellIcon className="w-4 h-4 text-orange-600" /><span>Relance email</span>
        {(!hasEmail || !hasDette) && <span className="ml-auto text-xs text-neutral-400">N/A</span>}
      </button>
      <button onClick={() => { onRapport(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-neutral-50 flex items-center gap-3 text-neutral-700 border-b border-neutral-100">
        <PrinterIcon className="w-4 h-4 text-purple-600" /><span>Rapport fournisseur</span>
      </button>
      <button onClick={() => { onDelete(); setIsOpen(false); }}
        className="w-full px-4 py-2.5 text-left text-sm hover:bg-red-50 flex items-center gap-3 text-red-600">
        <XCircleIcon className="w-4 h-4" /><span>Supprimer fournisseur</span>
      </button>
    </div>
  );

  return (
    <div className="relative" ref={buttonRef}>
      <button ref={buttonRef} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1.5 hover:bg-neutral-100 rounded-lg text-neutral-600 transition-colors" title="Actions">
        <EllipsisVerticalIcon className="w-5 h-5" />
      </button>
      {isOpen && createPortal(dropdownContent, document.body)}
    </div>
  );
}

// ============ MODAL DÉTAILS ============
function ModalDetailsFournisseur({ fournisseur, onClose, store, onRelance, onImprimerCommande }: any) {
  const commandes = store.getCommandesByFournisseur(fournisseur.id);
  const reglements = store.getReglementsByFournisseur(fournisseur.id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
      <div className="bg-white rounded-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Fiche Fournisseur: {fournisseur.raison_sociale}</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Solde Initial</p>
            <p className="text-lg font-bold font-mono">{fournisseur.solde_initial.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Factures</p>
            <p className="text-lg font-bold font-mono text-primary-700">{fournisseur.cumul_factures.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Règlements</p>
            <p className="text-lg font-bold font-mono text-green-600">{fournisseur.cumul_reglements.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Solde Actuel (Dette)</p>
            <p className={`text-lg font-bold font-mono ${fournisseur.solde_actuel > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {fournisseur.solde_actuel.toLocaleString('fr-FR')} F
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
            <TruckIcon className="w-5 h-5" />
            Commandes ({commandes.length})
          </h4>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">N° Commande</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Type</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Total TTC</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Reste à payer</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-neutral-600">Statut</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-neutral-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {commandes.map((cmd: CommandeFournisseur) => (
                  <tr key={cmd.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2 text-sm">{cmd.date} {cmd.heure}</td>
                    <td className="px-4 py-2 text-sm font-mono text-primary-700">{cmd.numero}</td>
                    <td className="px-4 py-2 text-sm">
                      <span className="px-2 py-1 rounded text-xs bg-purple-100 text-purple-700">{cmd.type}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-right font-mono">{cmd.total_ttc.toLocaleString('fr-FR')} F</td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-red-600">{cmd.reste_a_payer.toLocaleString('fr-FR')} F</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        cmd.statut === 'LIVREE' ? 'bg-green-100 text-green-700' :
                        cmd.statut === 'ENVOYEE' ? 'bg-blue-100 text-blue-700' :
                        cmd.statut === 'PARTIELLE' ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {cmd.statut}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center flex justify-center gap-1">
                      <button onClick={() => onImprimerCommande(cmd, fournisseur)}
                        className="p-1 hover:bg-blue-50 rounded text-blue-600" title="Imprimer">
                        <PrinterIcon className="w-4 h-4" />
                      </button>
                      {cmd.reste_a_payer > 0 && fournisseur.email && (
                        <button onClick={onRelance}
                          className="p-1 hover:bg-orange-50 rounded text-orange-600" title="Relance email">
                          <BellIcon className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h4 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
            <CreditCardIcon className="w-5 h-5" />
            Règlements ({reglements.length})
          </h4>
          <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">N° Règlement</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Montant</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Type</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Référence</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Caisse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {reglements.map((r: ReglementFournisseur) => {
                  const caisse = CAISSES_MOCK.find(c => c.id === r.caisse_id);
                  return (
                    <tr key={r.id} className="hover:bg-neutral-50">
                      <td className="px-4 py-2 text-sm">{r.date}</td>
                      <td className="px-4 py-2 text-sm font-mono text-primary-700">{r.numero}</td>
                      <td className="px-4 py-2 text-sm text-right font-mono text-green-600">{r.montant.toLocaleString('fr-FR')} F</td>
                      <td className="px-4 py-2 text-sm">{r.type_reglement}</td>
                      <td className="px-4 py-2 text-sm">{r.reference || '-'}</td>
                      <td className="px-4 py-2 text-sm text-blue-700">{caisse?.nom || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MODAL COMMANDE ============
function ModalCommande({ fournisseur, onClose, store }: any) {
  const [type, setType] = useState<'COMMANDE' | 'BON_COMMANDE'>('COMMANDE');
  const [lignes, setLignes] = useState<LigneCommande[]>([]);
  const [nouvelleLigne, setNouvelleLigne] = useState({
    code_ref: '', designation: '', quantite: 1, prix_unitaire_ht: 0, remise: 0, tva: 18,
  });
  const [dateLivraison, setDateLivraison] = useState('');

  const total_ht = lignes.reduce((sum, l) => sum + l.total_ht, 0);
  const total_tva = lignes.reduce((sum, l) => sum + l.tva, 0);
  const total_ttc = total_ht + total_tva;

  const ajouterLigne = () => {
    if (nouvelleLigne.code_ref && nouvelleLigne.designation) {
      const total_ht_ligne = nouvelleLigne.prix_unitaire_ht * nouvelleLigne.quantite * (1 - nouvelleLigne.remise / 100);
      const tva_ligne = total_ht_ligne * nouvelleLigne.tva / 100;
      setLignes([...lignes, { ...nouvelleLigne, total_ht: total_ht_ligne, tva: tva_ligne }]);
      setNouvelleLigne({ code_ref: '', designation: '', quantite: 1, prix_unitaire_ht: 0, remise: 0, tva: 18 });
    }
  };

  const validerCommande = () => {
    if (lignes.length > 0) {
      store.createCommande({
        fournisseur_id: fournisseur.id,
        date: new Date().toISOString().split('T')[0],
        heure: new Date().toTimeString().slice(0, 5),
        type, statut: 'BROUILLON',
        lignes, total_ht, total_tva, total_ttc,
        reste_a_payer: total_ttc, montant_paye: 0,
        date_livraison_prevue: dateLivraison || undefined,
      });
      alert(`✅ ${type === 'BON_COMMANDE' ? 'Bon de commande' : 'Commande'} créé(e) avec succès !`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">Créer {type === 'BON_COMMANDE' ? 'un Bon de Commande' : 'une Commande'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <div className="flex gap-2 mb-4">
            <button onClick={() => setType('COMMANDE')} className={`px-4 py-2 rounded-lg font-medium ${type === 'COMMANDE' ? 'bg-purple-600 text-white' : 'bg-neutral-100'}`}>Commande</button>
            <button onClick={() => setType('BON_COMMANDE')} className={`px-4 py-2 rounded-lg font-medium ${type === 'BON_COMMANDE' ? 'bg-blue-600 text-white' : 'bg-neutral-100'}`}>Bon de Commande</button>
          </div>

          <div className="bg-neutral-50 p-4 rounded-lg mb-4">
            <h4 className="font-semibold mb-3">Fournisseur: {fournisseur.raison_sociale}</h4>
            <p className="text-sm text-neutral-600">Tél: {fournisseur.telephone}</p>
            <p className="text-sm text-neutral-600">Adresse: {fournisseur.adresse || 'N/A'}</p>
          </div>

          <div className="grid grid-cols-4 gap-3 mb-4">
            <input type="text" placeholder="Code/Réf" value={nouvelleLigne.code_ref} onChange={(e) => setNouvelleLigne({...nouvelleLigne, code_ref: e.target.value})} className="px-3 py-2 border border-neutral-200 rounded-lg" />
            <input type="text" placeholder="Désignation" value={nouvelleLigne.designation} onChange={(e) => setNouvelleLigne({...nouvelleLigne, designation: e.target.value})} className="px-3 py-2 border border-neutral-200 rounded-lg" />
            <input type="number" placeholder="Qté" value={nouvelleLigne.quantite} onChange={(e) => setNouvelleLigne({...nouvelleLigne, quantite: Number(e.target.value)})} className="px-3 py-2 border border-neutral-200 rounded-lg" />
            <input type="number" placeholder="P.U. HT" value={nouvelleLigne.prix_unitaire_ht} onChange={(e) => setNouvelleLigne({...nouvelleLigne, prix_unitaire_ht: Number(e.target.value)})} className="px-3 py-2 border border-neutral-200 rounded-lg" />
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <input type="number" placeholder="Remise %" value={nouvelleLigne.remise} onChange={(e) => setNouvelleLigne({...nouvelleLigne, remise: Number(e.target.value)})} className="px-3 py-2 border border-neutral-200 rounded-lg" />
            <input type="number" placeholder="TVA %" value={nouvelleLigne.tva} onChange={(e) => setNouvelleLigne({...nouvelleLigne, tva: Number(e.target.value)})} className="px-3 py-2 border border-neutral-200 rounded-lg" />
            <input type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} className="px-3 py-2 border border-neutral-200 rounded-lg" placeholder="Date livraison prévue" />
          </div>
          <button onClick={ajouterLigne} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
            <PlusIcon className="w-4 h-4 inline mr-2" /> Ajouter ligne
          </button>
        </div>

        {lignes.length > 0 && (
          <div className="border border-neutral-200 rounded-lg overflow-hidden mb-6">
            <table className="w-full">
              <thead className="bg-neutral-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs">Code</th>
                  <th className="px-4 py-2 text-left text-xs">Désignation</th>
                  <th className="px-4 py-2 text-right text-xs">Qté</th>
                  <th className="px-4 py-2 text-right text-xs">P.U. HT</th>
                  <th className="px-4 py-2 text-right text-xs">Remise</th>
                  <th className="px-4 py-2 text-right text-xs">Total HT</th>
                  <th className="px-4 py-2 text-right text-xs">TVA</th>
                  <th className="px-4 py-2 text-center text-xs">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {lignes.map((ligne, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-2 text-sm">{ligne.code_ref}</td>
                    <td className="px-4 py-2 text-sm">{ligne.designation}</td>
                    <td className="px-4 py-2 text-sm text-right">{ligne.quantite}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono">{ligne.prix_unitaire_ht.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-sm text-right">{ligne.remise}%</td>
                    <td className="px-4 py-2 text-sm text-right font-mono">{ligne.total_ht.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono">{ligne.tva.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-2 text-center">
                      <button onClick={() => setLignes(lignes.filter((_, i) => i !== idx))} className="text-red-600 hover:text-red-700">
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-neutral-50 p-4 rounded-lg mb-6">
          <div className="flex justify-between mb-2">
            <span>Total HT:</span>
            <span className="font-mono font-bold">{total_ht.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="flex justify-between mb-2">
            <span>TVA:</span>
            <span className="font-mono">{total_tva.toLocaleString('fr-FR')} F</span>
          </div>
          <div className="flex justify-between text-lg font-bold border-t border-neutral-200 pt-2">
            <span>Total TTC:</span>
            <span className="font-mono text-primary-700">{total_ttc.toLocaleString('fr-FR')} F</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button onClick={validerCommande} className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">
            Valider {type === 'BON_COMMANDE' ? 'le Bon' : 'la Commande'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ MODAL RÈGLEMENT (avec caisse) ============
function ModalReglement({ fournisseur, onClose, store, caisses }: any) {
  const [montant, setMontant] = useState(0);
  const [type_reglement, setTypeReglement] = useState<TypeReglement>('ESPECES');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reference, setReference] = useState('');
  const [caisseId, setCaisseId] = useState('');
  const commandesImpayees = store.getCommandesByFournisseur(fournisseur.id).filter((c: CommandeFournisseur) => c.reste_a_payer > 0);
  const [commandeId, setCommandeId] = useState(commandesImpayees[0]?.id || '');

  const validerReglement = () => {
    if (montant > 0 && caisseId) {
      store.addReglement({
        fournisseur_id: fournisseur.id,
        montant,
        type_reglement,
        date,
        reference,
        commande_id: commandeId || undefined,
        caisse_id: caisseId,
      });
      const caisseNom = caisses.find((c: Caisse) => c.id === caisseId)?.nom;
      alert(`✅ Règlement de ${montant.toLocaleString('fr-FR')} F enregistré dans ${caisseNom}`);
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
          <p className="text-sm text-red-700">Fournisseur: <strong>{fournisseur.raison_sociale}</strong></p>
          <p className="text-sm text-red-700">Dette actuelle: <strong>{fournisseur.solde_actuel.toLocaleString('fr-FR')} F</strong></p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Caisse *</label>
            <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500">
              <option value="">-- Sélectionner une caisse --</option>
              {caisses.map((c: Caisse) => (
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
            <select value={type_reglement} onChange={(e) => setTypeReglement(e.target.value as TypeReglement)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
              <option value="ESPECES">Espèces</option>
              <option value="CHEQUE">Chèque</option>
              <option value="VIREMENT">Virement</option>
              <option value="MOBILE_MONEY">Mobile Money</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Référence</label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)}
              placeholder="N° chèque, virement..." className="w-full px-3 py-2 border border-neutral-200 rounded-lg" />
          </div>
          {commandesImpayees.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Imputer sur la commande</label>
              <select value={commandeId} onChange={(e) => setCommandeId(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-200 rounded-lg">
                <option value="">-- Aucune --</option>
                {commandesImpayees.map((c: CommandeFournisseur) => (
                  <option key={c.id} value={c.id}>{c.numero} - Reste: {c.reste_a_payer.toLocaleString('fr-FR')} F</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
            <button onClick={validerReglement} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg">Valider</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MODAL APPROVISIONNEMENT (avec caisse) ============
function ModalApprovisionnement({ fournisseur, onClose, store, caisses }: any) {
  const [montant, setMontant] = useState(0);
  const [motif, setMotif] = useState('Augmentation plafond crédit');
  const [caisseId, setCaisseId] = useState('');

  const valider = () => {
    if (montant > 0 && caisseId) {
      store.updateFournisseur(fournisseur.id, {
        plafond_credit: fournisseur.plafond_credit + montant,
      });
      const caisseNom = caisses.find((c: Caisse) => c.id === caisseId)?.nom;
      alert(`✅ Plafond augmenté de ${montant.toLocaleString('fr-FR')} FCFA via ${caisseNom}`);
      onClose();
    } else if (!caisseId) {
      alert('⚠️ Veuillez sélectionner une caisse');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Augmenter le plafond crédit</h3>
        <div className="bg-blue-50 p-4 rounded-lg mb-4">
          <p className="text-sm text-blue-700">Fournisseur: <strong>{fournisseur.raison_sociale}</strong></p>
          <p className="text-sm text-blue-700">Plafond actuel: <strong>{fournisseur.plafond_credit.toLocaleString('fr-FR')} F</strong></p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Caisse *</label>
            <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">-- Sélectionner une caisse --</option>
              {caisses.map((c: Caisse) => (
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
              <option>Augmentation plafond crédit</option>
              <option>Négociation commerciale</option>
              <option>Partenariat stratégique</option>
              <option>Autre</option>
            </select>
          </div>
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
            <button onClick={valider} className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg">Valider</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MODAL RELANCE ============
function ModalRelance({ fournisseur, onClose, store }: any) {
  const commandesImpayees = store.getCommandesByFournisseur(fournisseur.id).filter((c: CommandeFournisseur) => c.reste_a_payer > 0);

  const envoyerRelance = () => {
    if (commandesImpayees.length > 0 && fournisseur.email) {
      commandesImpayees.forEach((c: CommandeFournisseur) => store.sendRelance(fournisseur.id, c.id));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <BellIcon className="w-5 h-5 text-orange-600" />
          Envoyer une relance email
        </h3>
        <div className="mb-4">
          <p className="text-sm text-neutral-600 mb-2">Fournisseur: <strong>{fournisseur.raison_sociale}</strong></p>
          <p className="text-sm text-neutral-600">Email: <strong>{fournisseur.email}</strong></p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-orange-800 font-medium">{commandesImpayees.length} commande(s) impayée(s)</p>
          <div className="mt-2 space-y-1">
            {commandesImpayees.map((c: CommandeFournisseur) => (
              <p key={c.id} className="text-xs text-orange-700">
                {c.numero}: {c.reste_a_payer.toLocaleString('fr-FR')} FCFA
              </p>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <button onClick={envoyerRelance} className="flex-1 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg">
            <PaperAirplaneIcon className="w-4 h-4 inline mr-2" /> Envoyer relance
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ MODAL RAPPORT ============
function ModalRapport({ fournisseur, onClose, store }: any) {
  const commandes = store.getCommandesByFournisseur(fournisseur.id);
  const reglements = store.getReglementsByFournisseur(fournisseur.id);
  const totalCommandes = commandes.reduce((sum: number, c: CommandeFournisseur) => sum + c.total_ttc, 0);
  const totalReglements = reglements.reduce((sum, r) => sum + r.montant, 0);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:p-0">
      <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-6 print:max-w-none print:h-auto">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <h3 className="text-xl font-bold">Rapport Fournisseur: {fournisseur.raison_sociale}</h3>
          <div className="flex gap-2">
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              <PrinterIcon className="w-5 h-5" /> Imprimer
            </button>
            <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg">
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="hidden print:block mb-6 border-b border-neutral-200 pb-4">
          <h1 className="text-2xl font-bold text-neutral-900">Q.C.F - QUINCAILLERIE CISSÉ & FRÈRES</h1>
          <p className="text-sm text-neutral-600">RAPPORT FOURNISSEUR</p>
          <p className="text-sm">Date: {new Date().toLocaleDateString('fr-FR')}</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">N° Compte</p>
            <p className="text-lg font-bold font-mono">{fournisseur.numero_compte}</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Total Commandes</p>
            <p className="text-lg font-bold font-mono text-primary-700">{totalCommandes.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Total Règlements</p>
            <p className="text-lg font-bold font-mono text-green-600">{totalReglements.toLocaleString('fr-FR')} F</p>
          </div>
          <div className="bg-neutral-50 p-4 rounded-lg">
            <p className="text-xs text-neutral-500">Solde Dû</p>
            <p className={`text-lg font-bold font-mono ${fournisseur.solde_actuel > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {fournisseur.solde_actuel.toLocaleString('fr-FR')} F
            </p>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold mb-3">Informations de contact</h4>
          <div className="grid grid-cols-2 gap-4 bg-neutral-50 p-4 rounded-lg">
            <div>
              <p className="text-xs text-neutral-500">Raison sociale</p>
              <p className="font-medium">{fournisseur.raison_sociale}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Téléphone</p>
              <p className="font-medium">{fournisseur.telephone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Email</p>
              <p className="font-medium">{fournisseur.email || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-neutral-500">Adresse</p>
              <p className="font-medium">{fournisseur.adresse || 'N/A'}</p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h4 className="font-semibold mb-3">Historique des commandes ({commandes.length})</h4>
          <table className="w-full border border-neutral-200 rounded-lg overflow-hidden">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">N°</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Type</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Total TTC</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Reste</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-neutral-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {commandes.map((c: CommandeFournisseur) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 text-sm">{c.date}</td>
                  <td className="px-4 py-2 text-sm font-mono">{c.numero}</td>
                  <td className="px-4 py-2 text-sm">{c.type}</td>
                  <td className="px-4 py-2 text-sm text-right font-mono">{c.total_ttc.toLocaleString('fr-FR')} F</td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-red-600">{c.reste_a_payer.toLocaleString('fr-FR')} F</td>
                  <td className="px-4 py-2 text-center">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      c.statut === 'LIVREE' ? 'bg-green-100 text-green-700' :
                      c.statut === 'ENVOYEE' ? 'bg-blue-100 text-blue-700' :
                      'bg-orange-100 text-orange-700'
                    }`}>
                      {c.statut}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div>
          <h4 className="font-semibold mb-3">Historique des règlements ({reglements.length})</h4>
          <table className="w-full border border-neutral-200 rounded-lg overflow-hidden">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">N°</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Montant</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Référence</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Caisse</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {reglements.map((r: ReglementFournisseur) => {
                const caisse = CAISSES_MOCK.find(c => c.id === r.caisse_id);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2 text-sm">{r.date}</td>
                    <td className="px-4 py-2 text-sm font-mono">{r.numero}</td>
                    <td className="px-4 py-2 text-sm text-right font-mono text-green-600">{r.montant.toLocaleString('fr-FR')} F</td>
                    <td className="px-4 py-2 text-sm">{r.type_reglement}</td>
                    <td className="px-4 py-2 text-sm">{r.reference || '-'}</td>
                    <td className="px-4 py-2 text-sm text-blue-700">{caisse?.nom || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 pt-6 border-t border-neutral-200 print:block hidden">
          <p className="text-sm text-neutral-600">Document généré le {new Date().toLocaleString('fr-FR')}</p>
          <p className="text-sm text-neutral-600 mt-2">Q.C.F SASU - Tél: 27 32 79 50 90</p>
        </div>
      </div>

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

// ============ IMPRESSION COMMANDE ============
function printCommande(commande: CommandeFournisseur, fournisseur: Fournisseur) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Commande ${commande.numero}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { margin: 0; color: #1e40af; }
        .info { margin-bottom: 30px; display: flex; justify-content: space-between; }
        .info-box { flex: 1; padding: 15px; background: #f5f5f5; border-radius: 8px; margin: 0 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #1e40af; color: white; }
        .total { text-align: right; font-size: 18px; font-weight: bold; color: #1e40af; }
        .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Q.C.F - QUINCAILLERIE CISSÉ & FRÈRES</h1>
        <p>${commande.type === 'BON_COMMANDE' ? 'BON DE COMMANDE' : 'COMMANDE'} N° ${commande.numero}</p>
        <p>Date: ${commande.date} ${commande.heure}</p>
      </div>
      
      <div class="info">
        <div class="info-box">
          <h3>Fournisseur</h3>
          <p><strong>${fournisseur.raison_sociale}</strong></p>
          <p>N° Compte: ${fournisseur.numero_compte}</p>
          <p>Tél: ${fournisseur.telephone || 'N/A'}</p>
          <p>Email: ${fournisseur.email || 'N/A'}</p>
          <p>Adresse: ${fournisseur.adresse || 'N/A'}</p>
        </div>
        <div class="info-box">
          <h3>Détails</h3>
          <p>Statut: ${commande.statut}</p>
          <p>Date livraison prévue: ${commande.date_livraison_prevue || 'N/A'}</p>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Code/Réf</th>
            <th>Désignation</th>
            <th>Qté</th>
            <th>P.U. HT</th>
            <th>Remise</th>
            <th>Total HT</th>
            <th>TVA</th>
          </tr>
        </thead>
        <tbody>
          ${commande.lignes.map(l => `
            <tr>
              <td>${l.code_ref}</td>
              <td>${l.designation}</td>
              <td>${l.quantite}</td>
              <td>${l.prix_unitaire_ht.toLocaleString('fr-FR')} F</td>
              <td>${l.remise}%</td>
              <td>${l.total_ht.toLocaleString('fr-FR')} F</td>
              <td>${l.tva.toLocaleString('fr-FR')} F</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="total">
        <p>Total HT: ${commande.total_ht.toLocaleString('fr-FR')} FCFA</p>
        <p>Total TVA: ${commande.total_tva.toLocaleString('fr-FR')} FCFA</p>
        <p style="font-size: 24px; color: #1e40af;">Total TTC: ${commande.total_ttc.toLocaleString('fr-FR')} FCFA</p>
      </div>

      <div class="footer">
        <p>Q.C.F SASU - Tél: 27 32 79 50 90</p>
        <p>Document généré le ${new Date().toLocaleString('fr-FR')}</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
  printWindow.print();
}