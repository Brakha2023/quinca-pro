import { useState } from 'react';
import { XMarkIcon, CheckCircleIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface Vente {
  id: string;
  date: string;
  heure: string;
  numero: string;
  total_ttc: number;
  mt_percu: number;
  reste_a_payer: number;
  client: string;
  utilisateur: string;
  etat: 'En attente' | 'Consolidée' | 'Validée';
}

interface Caisse {
  id: string;
  nom: string;
  responsable: string;
}

const VENTES_MOCK: Vente[] = [
  { id: '1', date: '14/09/2026', heure: '10:24', numero: 'V20260914-00001', total_ttc: 12500, mt_percu: 12500, reste_a_payer: 0, client: 'Client Comptoir', utilisateur: 'Caissier 1', etat: 'En attente' },
  { id: '2', date: '14/09/2026', heure: '10:30', numero: 'V20260914-00002', total_ttc: 45000, mt_percu: 45000, reste_a_payer: 0, client: 'SARL Bâtiment Plus', utilisateur: 'Caissier 1', etat: 'En attente' },
  { id: '3', date: '14/09/2026', heure: '11:15', numero: 'V20260914-00003', total_ttc: 8500, mt_percu: 10000, reste_a_payer: 0, client: 'Client Comptoir', utilisateur: 'Caissier 2', etat: 'En attente' },
];

const CAISSES_MOCK: Caisse[] = [
  { id: '1', nom: 'Caisse Principale', responsable: 'Mme. Koné' },
  { id: '2', nom: 'Caisse Secondaire', responsable: 'M. Traoré' },
  { id: '3', nom: 'Caisse Livraison', responsable: 'M. Diabaté' },
];

export default function VenteDayPage() {
  const [ventes, setVentes] = useState<Vente[]>(VENTES_MOCK);
  const [caisseSelectionnee, setCaisseSelectionnee] = useState<string>('');
  const [ventesSelectionnees, setVentesSelectionnees] = useState<Set<string>>(new Set());
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [recherche, setRecherche] = useState('');

  const ventesFiltrees = ventes.filter(v => 
    v.numero.toLowerCase().includes(recherche.toLowerCase()) || 
    v.client.toLowerCase().includes(recherche.toLowerCase())
  );

  const totalGeneral = ventesFiltrees.reduce((sum, v) => sum + v.total_ttc, 0);
  const totalPercu = ventesFiltrees.reduce((sum, v) => sum + v.mt_percu, 0);

  const toggleVenteSelection = (venteId: string) => {
    const newSelection = new Set(ventesSelectionnees);
    if (newSelection.has(venteId)) {
      newSelection.delete(venteId);
    } else {
      newSelection.add(venteId);
    }
    setVentesSelectionnees(newSelection);
  };

  const validerVentes = () => {
    if (!caisseSelectionnee) {
      alert('⚠️ Veuillez sélectionner une caisse');
      return;
    }
    if (ventesSelectionnees.size === 0) {
      alert('⚠️ Veuillez sélectionner au moins une vente à valider');
      return;
    }

    setVentes(ventes.map(v => 
      ventesSelectionnees.has(v.id) ? { ...v, etat: 'Validée' as const } : v
    ));
    
    const caisseNom = CAISSES_MOCK.find(c => c.id === caisseSelectionnee)?.nom;
    alert(`✅ ${ventesSelectionnees.size} vente(s) validée(s) avec succès dans ${caisseNom}`);
    setVentesSelectionnees(new Set());
    setShowValidationModal(false);
  };

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-xl shadow-lg">
        <h1 className="text-2xl font-bold mb-2">VENTE DAY</h1>
        <p className="text-blue-100">Validation et dépôt des ventes de la journée en caisse</p>
      </div>

      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher N° vente ou client..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Caisse de dépôt</label>
            <select
              value={caisseSelectionnee}
              onChange={(e) => setCaisseSelectionnee(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Sélectionner une caisse --</option>
              {CAISSES_MOCK.map(c => (
                <option key={c.id} value={c.id}>{c.nom} ({c.responsable})</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => setShowValidationModal(true)}
              disabled={ventesSelectionnees.size === 0 || !caisseSelectionnee}
              className="w-full py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white font-medium rounded-lg flex items-center justify-center gap-2"
            >
              <CheckCircleIcon className="w-5 h-5" />
              Valider ({ventesSelectionnees.size})
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-blue-600 font-medium">Total Ventes</p>
            <p className="text-lg font-bold text-blue-700">{totalGeneral.toLocaleString('fr-FR')} FCFA</p>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-xs text-green-600 font-medium">Total Perçu</p>
            <p className="text-lg font-bold text-green-700">{totalPercu.toLocaleString('fr-FR')} FCFA</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-700 text-white">
            <tr>
              <th className="px-3 py-3 text-left text-xs font-medium">
                <input 
                  type="checkbox" 
                  onChange={(e) => {
                    if (e.target.checked) {
                      setVentesSelectionnees(new Set(ventesFiltrees.filter(v => v.etat === 'En attente').map(v => v.id)));
                    } else {
                      setVentesSelectionnees(new Set());
                    }
                  }}
                  className="rounded"
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium">DATE</th>
              <th className="px-3 py-3 text-left text-xs font-medium">HEURE</th>
              <th className="px-3 py-3 text-left text-xs font-medium">N° VENTE</th>
              <th className="px-3 py-3 text-right text-xs font-medium">TOTAL TTC</th>
              <th className="px-3 py-3 text-right text-xs font-medium">MT PERÇU</th>
              <th className="px-3 py-3 text-left text-xs font-medium">CLIENT</th>
              <th className="px-3 py-3 text-center text-xs font-medium">ÉTAT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {ventesFiltrees.map((vente) => (
              <tr 
                key={vente.id} 
                className={`hover:bg-neutral-50 transition-colors ${
                  ventesSelectionnees.has(vente.id) ? 'bg-blue-50' : ''
                } ${vente.etat === 'Validée' ? 'bg-green-50' : ''}`}
              >
                <td className="px-3 py-3">
                  <input 
                    type="checkbox" 
                    checked={ventesSelectionnees.has(vente.id)}
                    onChange={() => toggleVenteSelection(vente.id)}
                    disabled={vente.etat !== 'En attente'}
                    className="rounded"
                  />
                </td>
                <td className="px-3 py-3 text-sm">{vente.date}</td>
                <td className="px-3 py-3 text-sm font-mono">{vente.heure}</td>
                <td className="px-3 py-3 text-sm font-mono font-medium text-blue-700">{vente.numero}</td>
                <td className="px-3 py-3 text-sm text-right font-mono font-bold">{vente.total_ttc.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-3 text-sm text-right font-mono text-green-600">{vente.mt_percu.toLocaleString('fr-FR')}</td>
                <td className="px-3 py-3 text-sm">{vente.client}</td>
                <td className="px-3 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    vente.etat === 'Validée' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {vente.etat}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showValidationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
                Validation des ventes
              </h3>
              <button onClick={() => setShowValidationModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800 mb-2"><strong>Caisse sélectionnée :</strong></p>
              <p className="text-lg font-bold text-blue-900">
                {CAISSES_MOCK.find(c => c.id === caisseSelectionnee)?.nom}
              </p>
            </div>
            <div className="mb-4">
              <p className="text-sm text-neutral-600 mb-2">
                Vous allez valider <strong>{ventesSelectionnees.size} vente(s)</strong> pour un montant total de :
              </p>
              <p className="text-2xl font-bold text-green-600">
                {Array.from(ventesSelectionnees)
                  .map(id => ventes.find(v => v.id === id))
                  .filter(Boolean)
                  .reduce((sum, v) => sum + (v?.total_ttc || 0), 0)
                  .toLocaleString('fr-FR')} FCFA
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowValidationModal(false)} className="flex-1 py-3 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
                Annuler
              </button>
              <button onClick={validerVentes} className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2">
                <CheckCircleIcon className="w-5 h-5" />
                Confirmer la validation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}