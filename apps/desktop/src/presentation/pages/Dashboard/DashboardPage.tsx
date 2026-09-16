import { useFilialeCourante } from '../../auth/useFilialeCourante';
import GraphiqueCa from '../../features/pilotage/GraphiqueCa';
import { useCaParJour, useIndicateursFiliales, useTopArticles } from '../../features/pilotage/hooks';
import { useVentes } from '../../features/ventes/hooks';
import { formaterFcfa } from '../../hooks/useFormatage';
import { formaterDateHeure } from '../../features/ventes/VenteDetailsModal';

function Kpi({ label, value, tone = 'text-neutral-900', sous }: { label: string; value: string; tone?: string; sous?: string }) {
  return (
    <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm">
      <p className="text-sm font-medium text-neutral-500">{label}</p>
      <p className={`text-2xl font-bold mt-2 font-mono ${tone}`}>{value}</p>
      {sous && <p className="text-xs text-neutral-500 mt-1">{sous}</p>}
    </div>
  );
}

/** Tableau de bord de la filiale courante, calculé en temps réel sur la base locale. */
export default function DashboardPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { indicateurs } = useIndicateursFiliales();
  const points = useCaParJour(filialeId);
  const top = useTopArticles(filialeId);
  const { ventes } = useVentes(filialeId, { jour: new Date().toISOString().slice(0, 10), limite: 8 });
  const i = filialeId ? indicateurs.find((x) => x.filiale_id === filialeId) : undefined;

  if (!filialeId) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
        {estVueConsolidee ? <p className="text-lg">Vue consolidée : voir la page Consolidation, ou sélectionnez une filiale.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-neutral-900">{filiale?.nom}</h1><p className="text-sm text-neutral-500 mt-1">Activité du jour · {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi label="CA du jour" value={formaterFcfa(i?.ca_jour)} tone="text-primary-700" sous={`${i?.ventes_jour ?? 0} vente(s) · encaissé ${formaterFcfa(i?.encaisse_jour)}`} />
        <Kpi label="CA du mois" value={formaterFcfa(i?.ca_mois)} sous={`${i?.ventes_mois ?? 0} vente(s)`} />
        <Kpi label="Créances clients" value={formaterFcfa(i?.creances)} tone={(i?.creances ?? 0) > 0 ? 'text-red-600' : 'text-neutral-900'} sous={`Dettes fournisseurs : ${formaterFcfa(i?.dettes)}`} />
        <Kpi label="Alertes stock" value={`${i?.alertes_stock ?? 0} article(s)`} tone={(i?.alertes_stock ?? 0) > 0 ? 'text-orange-600' : 'text-neutral-900'} sous={`Valeur du stock : ${formaterFcfa(i?.valeur_stock)} · Caisses : ${formaterFcfa(i?.tresorerie)}`} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-neutral-200 shadow-sm"><h3 className="text-lg font-semibold text-neutral-800 mb-4">Chiffre d'affaires — 7 derniers jours</h3><GraphiqueCa points={points} /></div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <h3 className="text-lg font-semibold text-neutral-800 mb-4">Top articles du mois</h3>
          {top.length === 0 ? <p className="text-sm text-neutral-400">Aucune vente ce mois-ci.</p> : (
            <ol className="space-y-2">{top.map((t, n) => <li key={t.code} className="flex items-center gap-3 text-sm"><span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">{n + 1}</span><span className="flex-1 truncate">{t.designation}</span><span className="text-neutral-500">{t.quantite}</span><span className="font-mono font-semibold">{formaterFcfa(t.ca)}</span></li>)}</ol>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200"><h3 className="text-lg font-semibold text-neutral-800">Dernières ventes du jour</h3></div>
        {ventes.length === 0 ? <p className="px-6 py-8 text-sm text-neutral-400">Aucune vente aujourd'hui.</p> : (
          <table className="w-full"><tbody className="divide-y divide-neutral-100">{ventes.map((v) => (
            <tr key={v.id} className={v.statut === 'ANNULEE' ? 'opacity-50' : ''}><td className="px-6 py-3 text-sm text-neutral-600">{formaterDateHeure(v.date_vente)}</td><td className="px-6 py-3 text-sm font-mono text-primary-700">{v.numero}</td><td className="px-6 py-3 text-sm">{v.client_nom ?? 'Comptoir'}</td><td className="px-6 py-3 text-sm text-neutral-600">{[v.utilisateur_prenom, v.utilisateur_nom].filter(Boolean).join(' ')}</td><td className="px-6 py-3 text-sm text-right font-mono font-semibold">{formaterFcfa(v.total_ttc)}</td></tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  );
}
