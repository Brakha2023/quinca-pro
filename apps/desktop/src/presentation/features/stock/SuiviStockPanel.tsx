import { useState } from 'react';
import { MagnifyingGlassIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { LIBELLES_ETAT_STOCK, statutStock, type StatutStock } from '../../../core/stock';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { formaterFcfa, formaterDate } from '../../hooks/useFormatage';
import { useDepots } from '../articles/hooks';
import type { InfosFiliale } from './EnteteBon';
import EtatStockDocument from './EtatStockDocument';
import { useStocks } from './hooks';

/** Couleurs de l'écran ; les libellés viennent de `core/stock`, comme sur le document imprimé. */
const STATUT_STYLE: Record<StatutStock, string> = {
  RUPTURE: 'bg-red-100 text-red-700',
  FAIBLE: 'bg-orange-100 text-orange-700',
  OK: 'bg-green-100 text-green-700',
  SURSTOCK: 'bg-blue-100 text-blue-700',
};

/** Stock par article et par dépôt, temps réel, avec valorisation au coût moyen. */
export default function SuiviStockPanel({ filialeId, filiale }: { filialeId: string; filiale: InfosFiliale }) {
  const { depots } = useDepots(filialeId);
  const [depotId, setDepotId] = useState('');
  const [recherche, setRecherche] = useState('');
  const [alertesSeulement, setAlertesSeulement] = useState(false);
  const [apercu, setApercu] = useState(false);
  const { stocks, isLoading } = useStocks(filialeId, { depotId: depotId || null, recherche, alertesSeulement });

  const valeur = stocks.reduce((s, l) => s + (l.quantite ?? 0) * (l.cout_moyen ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative flex-1 min-w-[16rem] max-w-md">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
          <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Code ou désignation…" className={`${inputClass} pl-10`} />
        </div>
        <select value={depotId} onChange={(e) => setDepotId(e.target.value)} className={controleInlineClass}>
          <option value="">Tous les dépôts</option>
          {depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-neutral-600">
          <input type="checkbox" checked={alertesSeulement} onChange={(e) => setAlertesSeulement(e.target.checked)} className="rounded" /> Alertes seulement
        </label>
        <span className="ml-auto text-sm text-neutral-600">Valeur affichée : <strong className="font-mono">{formaterFcfa(valeur)}</strong></span>
        <button onClick={() => setApercu(true)} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="imprimer-etat-stock"><PrinterIcon className="w-4 h-4" /> Imprimer</button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2 text-left">Article</th>
                <th className="px-3 py-2 text-left">Famille</th>
                <th className="px-3 py-2 text-left">Dépôt</th>
                <th className="px-3 py-2 text-right">Quantité</th>
                <th className="px-3 py-2 text-right">Réservée</th>
                <th className="px-3 py-2 text-right">Disponible</th>
                <th className="px-3 py-2 text-right">Coût moyen</th>
                <th className="px-3 py-2 text-right">Valeur</th>
                <th className="px-3 py-2 text-center">Statut</th>
                <th className="px-3 py-2 text-left">Dernier mvt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {stocks.map((s) => {
                const etat = statutStock(s.quantite ?? 0, s.article_stock_min ?? 0, s.article_stock_max ?? 0);
                return (
                  <tr key={s.id} className="hover:bg-neutral-50">
                    <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{s.article_code}</span>{s.article_designation}<span className="text-neutral-400 text-xs ml-2">{s.article_unite}</span></td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{s.famille_nom ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{s.depot_nom}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{s.quantite}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-neutral-500">{s.quantite_reservee}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{s.quantite_disponible}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(s.cout_moyen)}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa((s.quantite ?? 0) * (s.cout_moyen ?? 0))}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_STYLE[etat]}`}>{LIBELLES_ETAT_STOCK[etat]}</span></td>
                    <td className="px-3 py-2 text-sm text-neutral-500">{formaterDate(s.date_dernier_mouvement)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && stocks.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune ligne de stock{alertesSeulement ? ' en alerte' : ''}.</div>}
      </div>

      {apercu && (
        <EtatStockDocument
          stocks={stocks}
          filiale={filiale}
          filtres={{ depotNom: depots.find((d) => d.id === depotId)?.nom ?? null, recherche, alertesSeulement }}
          onClose={() => setApercu(false)}
        />
      )}
    </div>
  );
}
