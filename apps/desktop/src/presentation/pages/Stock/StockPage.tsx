import { Navigate, NavLink, useParams } from 'react-router-dom';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import AlertesPanel from '../../features/stock/AlertesPanel';
import EntreeStockPanel from '../../features/stock/EntreeStockPanel';
import InventairePanel from '../../features/stock/InventairePanel';
import MouvementsPanel from '../../features/stock/MouvementsPanel';
import ProductionPanel from '../../features/stock/ProductionPanel';
import SortieStockPanel from '../../features/stock/SortieStockPanel';
import SuiviStockPanel from '../../features/stock/SuiviStockPanel';
import TransfertStockPanel from '../../features/stock/TransfertStockPanel';
import { ONGLETS_STOCK, ONGLET_STOCK_DEFAUT, cheminOngletStock, estOngletStock } from './onglets';

/** Gestion du stock de la filiale courante : suivi, bons, inventaire, production, journal, alertes. */
export default function StockPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { onglet } = useParams();

  if (!estOngletStock(onglet)) return <Navigate to={cheminOngletStock(ONGLET_STOCK_DEFAUT)} replace />;

  const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };

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
            {ONGLETS_STOCK.map((o) => (
              <NavLink
                key={o.id}
                to={cheminOngletStock(o.id)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive ? 'border-primary-600 text-primary-700 bg-white' : 'border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                  }`
                }
              >
                <o.icon className="w-4 h-4" />
                {o.label}
              </NavLink>
            ))}
          </div>
          <div className="p-6">
            {onglet === 'suivi' && <SuiviStockPanel filialeId={filialeId} />}
            {onglet === 'entree' && <EntreeStockPanel filialeId={filialeId} filiale={infosFiliale} />}
            {onglet === 'sortie' && <SortieStockPanel filialeId={filialeId} filiale={infosFiliale} />}
            {onglet === 'transfert' && <TransfertStockPanel filialeId={filialeId} filiale={infosFiliale} />}
            {onglet === 'inventaire' && <InventairePanel filialeId={filialeId} filiale={infosFiliale} />}
            {onglet === 'production' && <ProductionPanel filialeId={filialeId} />}
            {onglet === 'mouvements' && <MouvementsPanel filialeId={filialeId} filiale={infosFiliale} />}
            {onglet === 'alertes' && <AlertesPanel filialeId={filialeId} />}
          </div>
        </div>
      )}
    </div>
  );
}
