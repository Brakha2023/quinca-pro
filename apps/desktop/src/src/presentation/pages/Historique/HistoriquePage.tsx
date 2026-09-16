import { useState } from 'react';
import { MagnifyingGlassIcon, CalendarIcon } from '@heroicons/react/24/outline';

interface VenteHistorique {
  id: string;
  numero: string;
  date: string;
  client: string;
  articles: number;
  total: number;
  mode_paiement: string;
  statut: 'VALIDEE' | 'ANNULEE';
}

const VENTES_MOCK: VenteHistorique[] = [
  {
    id: '1',
    numero: 'VTE-2026-00147',
    date: '2026-08-27 10:09',
    client: 'SARL Bâtiment Plus',
    articles: 5,
    total: 187500,
    mode_paiement: 'ESPECES',
    statut: 'VALIDEE',
  },
  {
    id: '2',
    numero: 'VTE-2026-00146',
    date: '2026-08-27 09:45',
    client: 'Client Comptoir',
    articles: 2,
    total: 67500,
    mode_paiement: 'MOBILE_MONEY',
    statut: 'VALIDEE',
  },
  {
    id: '3',
    numero: 'VTE-2026-00145',
    date: '2026-08-27 09:12',
    client: 'M. Koné Construction',
    articles: 8,
    total: 425000,
    mode_paiement: 'CREDIT_CLIENT',
    statut: 'VALIDEE',
  },
];

export default function HistoriquePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin] = useState('');

  const ventesFiltrees = VENTES_MOCK.filter(v =>
    v.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.client.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalVentes = ventesFiltrees.reduce((sum, v) => sum + v.total, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Historique des ventes</h1>
        <p className="text-sm text-neutral-500 mt-1">Consultez toutes les ventes enregistrées</p>
      </div>

      {/* Filtres */}
      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par N° ticket ou client..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Date début</label>
            <input
              type="date"
              value={dateDebut}
              onChange={(e) => setDateDebut(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Date fin</label>
            <input
              type="date"
              value={dateFin}
              onChange={(e) => setDateFin(e.target.value)}
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Nombre de ventes</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{ventesFiltrees.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Total TTC</p>
          <p className="text-2xl font-bold text-primary-700 font-mono mt-2">{totalVentes.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Panier moyen</p>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-2">
            {ventesFiltrees.length > 0 ? Math.round(totalVentes / ventesFiltrees.length).toLocaleString('fr-FR') : 0} F
          </p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">N° Ticket</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Client</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase">Articles</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Total TTC</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Paiement</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {ventesFiltrees.map((vente) => (
              <tr key={vente.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-6 py-4 text-sm font-mono font-medium text-primary-700">{vente.numero}</td>
                <td className="px-6 py-4 text-sm text-neutral-600">{vente.date}</td>
                <td className="px-6 py-4 text-sm font-medium text-neutral-900">{vente.client}</td>
                <td className="px-6 py-4 text-sm text-center text-neutral-600">{vente.articles}</td>
                <td className="px-6 py-4 text-sm text-right font-bold font-mono text-neutral-900">
                  {vente.total.toLocaleString('fr-FR')} F
                </td>
                <td className="px-6 py-4 text-sm text-neutral-600">{vente.mode_paiement.replace('_', ' ')}</td>
                <td className="px-6 py-4 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    vente.statut === 'VALIDEE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {vente.statut}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
