import { statutStock } from '../../../core/stock';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useStocksParArticle, type StockParArticle } from './hooks';

function Tableau({ titre, lignes, vide, tone }: { titre: string; lignes: StockParArticle[]; vide: string; tone: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
      <div className={`px-4 py-3 border-b border-neutral-200 font-semibold ${tone}`}>{titre} <span className="font-normal text-neutral-500">({lignes.length})</span></div>
      {lignes.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-400">{vide}</p>
      ) : (
        <table className="w-full">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Stock</th><th className="px-3 py-2 text-right">Min</th><th className="px-3 py-2 text-right">À commander</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((l) => (
              <tr key={l.article_id}>
                <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{l.quantite}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-neutral-500">{l.stock_min}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{Math.max((l.stock_max || l.stock_min * 2) - l.quantite, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Synthèse : valeur du stock, ruptures et stocks faibles (tous dépôts confondus). */
export default function AlertesPanel({ filialeId }: { filialeId: string }) {
  const { lignes } = useStocksParArticle(filialeId);
  const ruptures = lignes.filter((l) => statutStock(l.quantite, l.stock_min, l.stock_max) === 'RUPTURE');
  const faibles = lignes.filter((l) => statutStock(l.quantite, l.stock_min, l.stock_max) === 'FAIBLE');
  const valeur = lignes.reduce((s, l) => s + l.valeur, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">Valeur du stock (coût moyen)</p><p className="text-2xl font-bold font-mono mt-2">{formaterFcfa(valeur)}</p></div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">Articles suivis</p><p className="text-2xl font-bold mt-2">{lignes.length}</p></div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">Stock faible</p><p className="text-2xl font-bold mt-2">{faibles.length}</p></div>
        <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-xl text-white shadow"><p className="text-sm opacity-90">En rupture</p><p className="text-2xl font-bold mt-2">{ruptures.length}</p></div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tableau titre="Ruptures" lignes={ruptures} vide="Aucune rupture." tone="text-red-700" />
        <Tableau titre="Stocks faibles" lignes={faibles} vide="Aucun stock sous le minimum." tone="text-orange-700" />
      </div>
    </div>
  );
}
