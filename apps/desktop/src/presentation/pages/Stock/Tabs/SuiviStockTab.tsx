import { useState } from 'react';
import { useStockStore } from '../../../stores/stocks.store';
import { PrinterIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

export default function SuiviStockTab() {
  const store = useStockStore();
  const [filtreType, setFiltreType] = useState('Tous');
  const [filtreDepot, setFiltreDepot] = useState('Tous');
  const [recherche, setRecherche] = useState('');

  const mouvements = store.mouvements
    .filter(m => filtreType === 'Tous' || m.type === filtreType)
    .filter(m => filtreDepot === 'Tous' || m.depot_id === filtreDepot)
    .filter(m => m.reference.toLowerCase().includes(recherche.toLowerCase()) || m.motif.toLowerCase().includes(recherche.toLowerCase()))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getTypeColor = (type: string) => {
    if (type.includes('ENTREE')) return 'bg-green-100 text-green-700';
    if (type.includes('SORTIE')) return 'bg-red-100 text-red-700';
    if (type.includes('TRANSFERT')) return 'bg-blue-100 text-blue-700';
    if (type.includes('INVENTAIRE')) return 'bg-purple-100 text-purple-700';
    if (type.includes('PRODUCTION')) return 'bg-cyan-100 text-cyan-700';
    return 'bg-neutral-100 text-neutral-700';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Mouvements de stock</h3>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
          <PrinterIcon className="w-5 h-5" /> Imprimer
        </button>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-lg border border-neutral-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input type="text" value={recherche} onChange={(e) => setRecherche(e.target.value)}
              placeholder="Rechercher par référence ou motif..."
              className="w-full pl-10 pr-4 py-2 border border-neutral-200 rounded-lg" />
          </div>
          <select value={filtreType} onChange={(e) => setFiltreType(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg">
            <option value="Tous">Tous les types</option>
            <option value="ENTREE_ACHAT">Entrée achat</option>
            <option value="SORTIE_VENTE">Sortie vente</option>
            <option value="SORTIE_DESTOCKAGE">Déstockage</option>
            <option value="TRANSFERT_ENTREE">Transfert entrée</option>
            <option value="TRANSFERT_SORTIE">Transfert sortie</option>
            <option value="INVENTAIRE">Inventaire</option>
            <option value="PRODUCTION_ENTREE">Production entrée</option>
            <option value="PRODUCTION_SORTIE">Production sortie</option>
          </select>
          <select value={filtreDepot} onChange={(e) => setFiltreDepot(e.target.value)}
            className="px-3 py-2 border border-neutral-200 rounded-lg">
            <option value="Tous">Tous les dépôts</option>
            {store.depots.map(d => <option key={d.id} value={d.id}>{d.nom}</option>)}
          </select>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Date/Heure</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Type</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Article</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Qté</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Avant</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-neutral-600">Après</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Référence</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Motif</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-neutral-600">Utilisateur</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {mouvements.map((m) => {
              const article = store.articles.find(a => a.id === m.article_id);
              return (
                <tr key={m.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2 text-sm">
                    <div>{m.date}</div>
                    <div className="text-xs text-neutral-400">{m.heure}</div>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(m.type)}`}>
                      {m.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <div className="font-medium">{article?.designation || 'N/A'}</div>
                    <div className="text-xs text-neutral-500 font-mono">{article?.code}</div>
                  </td>
                  <td className="px-4 py-2 text-sm text-right font-mono font-bold">{m.quantite}</td>
                  <td className="px-4 py-2 text-sm text-right font-mono text-neutral-600">{m.quantite_avant}</td>
                  <td className="px-4 py-2 text-sm text-right font-mono font-medium">{m.quantite_apres}</td>
                  <td className="px-4 py-2 text-sm font-mono text-primary-700">{m.reference}</td>
                  <td className="px-4 py-2 text-sm text-neutral-600">{m.motif}</td>
                  <td className="px-4 py-2 text-sm text-neutral-700">{m.utilisateur}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {mouvements.length === 0 && (
          <div className="text-center py-12 text-neutral-400">Aucun mouvement trouvé</div>
        )}
      </div>
    </div>
  );
}