import { useState, type ComponentType } from 'react';
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowsRightLeftIcon, BellIcon,
  ClipboardDocumentCheckIcon, ClipboardDocumentListIcon, CubeIcon,
} from '@heroicons/react/24/outline';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import AlertesPanel from '../../features/stock/AlertesPanel';
import EntreeStockPanel from '../../features/stock/EntreeStockPanel';
import InventairePanel from '../../features/stock/InventairePanel';
import MouvementsPanel from '../../features/stock/MouvementsPanel';
import SortieStockPanel from '../../features/stock/SortieStockPanel';
import SuiviStockPanel from '../../features/stock/SuiviStockPanel';
import TransfertStockPanel from '../../features/stock/TransfertStockPanel';

type Onglet = 'suivi' | 'entree' | 'sortie' | 'transfert' | 'inventaire' | 'mouvements' | 'alertes';

const ONGLETS: Array<{ id: Onglet; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'suivi', label: 'Suivi de stock', icon: CubeIcon },
  { id: 'entree', label: 'Entrée', icon: ArrowDownTrayIcon },
  { id: 'sortie', label: 'Sortie / Casse', icon: ArrowUpTrayIcon },
  { id: 'transfert', label: 'Transfert', icon: ArrowsRightLeftIcon },
  { id: 'inventaire', label: 'Inventaire', icon: ClipboardDocumentCheckIcon },
  { id: 'mouvements', label: 'Mouvements', icon: ClipboardDocumentListIcon },
  { id: 'alertes', label: 'Alertes', icon: BellIcon },
];

/** Gestion du stock de la filiale courante : suivi, bons, inventaire, journal, alertes. */
export default function StockPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const [onglet, setOnglet] = useState<Onglet>('suivi');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">Gestion du stock</h1>
        <p className="text-sm text-neutral-500 mt-1">{filiale ? `${filiale.nom} · ` : ''}Mouvements enregistrés localement, synchronisés automatiquement.</p>
      </div>

      {!filialeId ? (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
          {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="flex overflow-x-auto border-b border-neutral-200 bg-neutral-50 print:hidden">
            {ONGLETS.map((o) => (
              <button
                key={o.id}
                onClick={() => setOnglet(o.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  onglet === o.id ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                <o.icon className="w-4 h-4" />
                {o.label}
              </button>
            ))}
          </div>
          <div className="p-6">
            {onglet === 'suivi' && <SuiviStockPanel filialeId={filialeId} />}
            {onglet === 'entree' && <EntreeStockPanel filialeId={filialeId} />}
            {onglet === 'sortie' && <SortieStockPanel filialeId={filialeId} />}
            {onglet === 'transfert' && <TransfertStockPanel filialeId={filialeId} />}
            {onglet === 'inventaire' && <InventairePanel filialeId={filialeId} />}
            {onglet === 'mouvements' && <MouvementsPanel filialeId={filialeId} />}
            {onglet === 'alertes' && <AlertesPanel filialeId={filialeId} />}
          </div>
        </div>
      )}
    </div>
  );
}
