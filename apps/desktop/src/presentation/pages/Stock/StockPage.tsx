import { useState } from 'react';
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon,
  ArrowsRightLeftIcon, BuildingLibraryIcon,
  CogIcon, ArrowTrendingDownIcon, ClipboardDocumentCheckIcon,
  BellIcon,
} from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';
import { useStockStore } from '../../stores/stocks.store';
import EntreeStockTab from './Tabs/EntreeStockTab';
import SortieStockTab from './Tabs/SortieStockTab';
import TransfertDepotTab from './Tabs/TransfertDepotTab';
import ProductionTab from './Tabs/ProductionTab';
import DestockageTab from './Tabs/DestockageTab';
import SuiviStockTab from './Tabs/SuiviStockTab';
import InventaireTab from './Tabs/InventaireTab';
import AlertesTab from './Tabs/AlertesTab';


type TabId = 'entree' | 'sortie' | 'transfert_depot' | 'transfert_filiale' | 'production' | 'destockage' | 'suivi' | 'inventaire' | 'alertes';

const TABS: Array<{ id: TabId; label: string; icon: ComponentType<{ className?: string }>; color: string }> = [
  { id: 'entree', label: 'Entrée en stock', icon: ArrowDownTrayIcon, color: 'bg-green-500' },
  { id: 'sortie', label: 'Sortie en stock', icon: ArrowUpTrayIcon, color: 'bg-orange-500' },
  { id: 'transfert_depot', label: 'Transfert inter-dépôt', icon: ArrowsRightLeftIcon, color: 'bg-purple-500' },
  { id: 'transfert_filiale', label: 'Transfert inter-filiale', icon: BuildingLibraryIcon, color: 'bg-indigo-500' },
  { id: 'production', label: 'Production', icon: CogIcon, color: 'bg-cyan-500' },
  { id: 'destockage', label: 'Déstockage', icon: ArrowTrendingDownIcon, color: 'bg-red-500' },
  { id: 'suivi', label: 'Suivi de stock', icon: ClipboardDocumentCheckIcon, color: 'bg-teal-500' },
  { id: 'inventaire', label: 'Inventaire physique', icon: ClipboardDocumentCheckIcon, color: 'bg-pink-500' },
  { id: 'alertes', label: 'Alertes & Rapports', icon: BellIcon, color: 'bg-amber-500' },

];

export default function StockPage() {
  const [activeTab, setActiveTab] = useState<TabId>('suivi');
  const store = useStockStore();

  const valeurStock = store.getValeurStockTotal();
  const nombreAlertes = store.getNombreAlertes();
  const articlesRupture = store.getArticlesEnRupture().length;
  const articlesFaible = store.getArticlesStockFaible().length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Gestion du Stock</h1>
          <p className="text-sm text-neutral-500 mt-1">
            {store.articles.length} articles • Valeur: {valeurStock.toLocaleString('fr-FR')} FCFA • {nombreAlertes} alertes
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">Valeur totale du stock</p>
          <p className="text-2xl font-bold font-mono mt-2">{valeurStock.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">Articles en stock</p>
          <p className="text-2xl font-bold mt-2">{store.articles.length - articlesRupture - articlesFaible}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">Stock faible</p>
          <p className="text-2xl font-bold mt-2">{articlesFaible}</p>
        </div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">En rupture</p>
          <p className="text-2xl font-bold mt-2">{articlesRupture}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50">
          {TABS.map((tab) => {
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-700 bg-white'
                    : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${tab.color}`}></div>
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'entree' && <EntreeStockTab />}
          {activeTab === 'sortie' && <SortieStockTab />}
          {activeTab === 'transfert_depot' && <TransfertDepotTab type="INTER_DEPOT" />}
          {activeTab === 'transfert_filiale' && <TransfertDepotTab type="INTER_FILIALE" />}
          {activeTab === 'production' && <ProductionTab />}
          {activeTab === 'destockage' && <DestockageTab />}
          {activeTab === 'suivi' && <SuiviStockTab />}
          {activeTab === 'inventaire' && <InventaireTab />}
          {activeTab === 'alertes' && <AlertesTab />}
        </div>
      </div>
    </div>
  );
}
