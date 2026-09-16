import { useStockStore } from '../../../stores/stocks.store';
import { BellIcon, PrinterIcon, ChartBarIcon } from '@heroicons/react/24/outline';

export default function AlertesTab() {
  const store = useStockStore();
  const articlesRupture = store.getArticlesEnRupture();
  const articlesFaible = store.getArticlesStockFaible();
  const topArticles = store.getTopArticles();
  const valeurStock = store.getValeurStockTotal();
  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Alertes & Rapports</h3>
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
          <PrinterIcon className="w-5 h-5" /> Imprimer rapport
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-red-500 to-red-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">Articles en rupture</p>
          <p className="text-3xl font-bold mt-2">{articlesRupture.length}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">Stock faible</p>
          <p className="text-3xl font-bold mt-2">{articlesFaible.length}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">Valeur totale stock</p>
          <p className="text-2xl font-bold font-mono mt-2">{valeurStock.toLocaleString('fr-FR')} F</p>
        </div>
        <div className="bg-gradient-to-br from-green-500 to-green-600 p-5 rounded-xl text-white shadow-lg">
          <p className="text-sm opacity-90">Total articles</p>
          <p className="text-3xl font-bold mt-2">{store.articles.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alertes rupture */}
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <div className="bg-red-50 px-4 py-3 border-b border-red-200 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-red-900">Articles en rupture ({articlesRupture.length})</h4>
          </div>
          <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
            {articlesRupture.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 text-sm">Aucun article en rupture</div>
            ) : (
              articlesRupture.map(a => (
                <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{a.designation}</p>
                    <p className="text-xs text-neutral-500 font-mono">{a.code} • {a.famille}</p>
                  </div>
                  <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">0 en stock</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Alertes stock faible */}
        <div className="bg-white rounded-xl border border-orange-200 shadow-sm overflow-hidden">
          <div className="bg-orange-50 px-4 py-3 border-b border-orange-200 flex items-center gap-2">
            <BellIcon className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold text-orange-900">Stock faible ({articlesFaible.length})</h4>
          </div>
          <div className="divide-y divide-neutral-100 max-h-64 overflow-y-auto">
            {articlesFaible.length === 0 ? (
              <div className="p-6 text-center text-neutral-400 text-sm">Aucun article en stock faible</div>
            ) : (
              articlesFaible.map(a => {
                const stock = store.getStockTotalByArticle(a.id);
                return (
                  <div key={a.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{a.designation}</p>
                      <p className="text-xs text-neutral-500 font-mono">{a.code} • Min: {a.stock_min}</p>
                    </div>
                    <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">{stock} restant</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Top articles */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="bg-neutral-50 px-4 py-3 border-b border-neutral-200 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-primary-600" />
          <h4 className="font-semibold text-neutral-900">Top 10 articles les plus vendus</h4>
        </div>
        <div className="divide-y divide-neutral-100">
          {topArticles.length === 0 ? (
            <div className="p-6 text-center text-neutral-400 text-sm">Aucune vente enregistrée</div>
          ) : (
            topArticles.map((item, idx) => (
              <div key={item.article.id} className="px-4 py-3 flex items-center gap-4">
                <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.article.designation}</p>
                  <p className="text-xs text-neutral-500 font-mono">{item.article.code}</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-700">{item.quantite}</p>
                  <p className="text-xs text-neutral-500">unités vendues</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}