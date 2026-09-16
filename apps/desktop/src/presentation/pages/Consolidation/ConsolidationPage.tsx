import { useFilialeCourante } from '../../auth/useFilialeCourante';
import GraphiqueCa from '../../features/pilotage/GraphiqueCa';
import { useCaParJour, useIndicateursFiliales, useTopArticles } from '../../features/pilotage/hooks';
import { formaterFcfa } from '../../hooks/useFormatage';

/** Vue groupe (directeur) : indicateurs par filiale et totaux consolidés, calculés localement. */
export default function ConsolidationPage() {
  const { estDirecteur, filialeId, filiale, setFilialeId } = useFilialeCourante();
  const { indicateurs, isLoading } = useIndicateursFiliales();
  const points = useCaParJour(null);
  const top = useTopArticles(null, undefined, 8);
  const somme = (k: keyof (typeof indicateurs)[number]) => indicateurs.reduce((s, i) => s + (Number(i[k]) || 0), 0);

  if (!estDirecteur) {
    return <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400"><p className="text-lg">La consolidation est réservée à la direction.</p><p className="text-sm mt-1">Votre filiale : {filiale?.nom}</p></div>;
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-neutral-900">Vue consolidée — Groupe</h1><p className="text-sm text-neutral-500 mt-1">Toutes les filiales · données synchronisées localement</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          ['CA du jour', formaterFcfa(somme('ca_jour')), 'text-primary-700'], ['CA du mois', formaterFcfa(somme('ca_mois')), 'text-neutral-900'],
          ['Créances clients', formaterFcfa(somme('creances')), 'text-red-600'], ['Dettes fournisseurs', formaterFcfa(somme('dettes')), 'text-orange-700'],
          ['Trésorerie (caisses)', formaterFcfa(somme('tresorerie')), 'text-green-700'],
        ].map(([l, v, t]) => <div key={l} className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">{l}</p><p className={`text-2xl font-bold font-mono mt-2 ${t}`}>{v}</p></div>)}
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200"><h3 className="text-lg font-semibold text-neutral-900">Performance par filiale</h3></div>
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr><th className="px-6 py-3 text-left">Filiale</th><th className="px-6 py-3 text-right">CA jour</th><th className="px-6 py-3 text-right">CA mois</th><th className="px-6 py-3 text-center">Ventes mois</th><th className="px-6 py-3 text-right">Créances</th><th className="px-6 py-3 text-right">Dettes</th><th className="px-6 py-3 text-right">Stock</th><th className="px-6 py-3 text-center">Alertes</th><th className="px-6 py-3 text-right">Caisses</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {indicateurs.map((i) => (
              <tr key={i.filiale_id} className={`hover:bg-neutral-50 cursor-pointer ${filialeId === i.filiale_id ? 'bg-primary-50' : ''}`} onClick={() => setFilialeId(i.filiale_id)} title="Ouvrir cette filiale">
                <td className="px-6 py-4"><p className="font-medium text-neutral-900">{i.filiale_nom}</p><p className="text-xs text-neutral-500">{i.filiale_code}</p></td>
                <td className="px-6 py-4 text-right font-mono">{formaterFcfa(i.ca_jour)}</td>
                <td className="px-6 py-4 text-right font-mono font-bold text-primary-700">{formaterFcfa(i.ca_mois)}</td>
                <td className="px-6 py-4 text-center">{i.ventes_mois}</td>
                <td className="px-6 py-4 text-right font-mono text-red-600">{formaterFcfa(i.creances)}</td>
                <td className="px-6 py-4 text-right font-mono text-orange-700">{formaterFcfa(i.dettes)}</td>
                <td className="px-6 py-4 text-right font-mono">{formaterFcfa(i.valeur_stock)}</td>
                <td className="px-6 py-4 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${i.alertes_stock ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>{i.alertes_stock}</span></td>
                <td className="px-6 py-4 text-right font-mono text-green-700">{formaterFcfa(i.tresorerie)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-neutral-200 shadow-sm"><h3 className="text-lg font-semibold text-neutral-800 mb-4">CA groupe — 7 derniers jours</h3><GraphiqueCa points={points} /></div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm"><h3 className="text-lg font-semibold text-neutral-800 mb-4">Top articles du mois (groupe)</h3>
          {top.length === 0 ? <p className="text-sm text-neutral-400">Aucune vente ce mois-ci.</p> : <ol className="space-y-2">{top.map((t, n) => <li key={t.code} className="flex items-center gap-3 text-sm"><span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">{n + 1}</span><span className="flex-1 truncate">{t.designation}</span><span className="font-mono font-semibold">{formaterFcfa(t.ca)}</span></li>)}</ol>}
        </div>
      </div>
    </div>
  );
}
