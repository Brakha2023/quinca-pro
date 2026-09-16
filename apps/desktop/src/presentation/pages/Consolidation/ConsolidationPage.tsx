import { useFilialesStore } from '../../stores/filiales.store';

interface FilialeData {
  code: string;
  nom: string;
  ca_jour: number;
  ca_mois: number;
  nombre_ventes: number;
  marge: number;
  creances: number;
}

const DONNEES_FILIALES: FilialeData[] = [
  {
    code: 'ABJ',
    nom: 'Filiale Abidjan',
    ca_jour: 1250000,
    ca_mois: 28500000,
    nombre_ventes: 156,
    marge: 32,
    creances: 850000,
  },
  {
    code: 'BKE',
    nom: 'Filiale Bouaké',
    ca_jour: 875000,
    ca_mois: 19200000,
    nombre_ventes: 98,
    marge: 28,
    creances: 420000,
  },
  {
    code: 'SPY',
    nom: 'Filiale San-Pedro',
    ca_jour: 620000,
    ca_mois: 14800000,
    nombre_ventes: 72,
    marge: 30,
    creances: 280000,
  },
];

export default function ConsolidationPage() {
  const { filialeSelectionnee } = useFilialesStore();

  const isConsolide = filialeSelectionnee.type === 'MAISON_MERE';

  const totalCAJour = DONNEES_FILIALES.reduce((sum, f) => sum + f.ca_jour, 0);
  const totalCAMois = DONNEES_FILIALES.reduce((sum, f) => sum + f.ca_mois, 0);
  const totalVentes = DONNEES_FILIALES.reduce((sum, f) => sum + f.nombre_ventes, 0);
  const totalCreances = DONNEES_FILIALES.reduce((sum, f) => sum + f.creances, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-neutral-900">
          {isConsolide ? 'Vue Consolidée - Groupe' : filialeSelectionnee.nom}
        </h1>
        <p className="text-sm text-neutral-500 mt-1">
          {isConsolide ? 'Performance de toutes les filiales' : `Performance de ${filialeSelectionnee.nom}`}
        </p>
      </div>

      {/* KPIs Globaux */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">CA du jour</p>
          <p className="text-2xl font-bold text-neutral-900 font-mono mt-2">
            {totalCAJour.toLocaleString('fr-FR')} F
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">CA du mois</p>
          <p className="text-2xl font-bold text-primary-700 font-mono mt-2">
            {totalCAMois.toLocaleString('fr-FR')} F
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Nombre de ventes</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{totalVentes}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Créances totales</p>
          <p className="text-2xl font-bold text-red-600 font-mono mt-2">
            {totalCreances.toLocaleString('fr-FR')} F
          </p>
        </div>
      </div>

      {/* Tableau comparatif des filiales */}
      {isConsolide && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h3 className="text-lg font-semibold text-neutral-900">Performance par filiale</h3>
          </div>
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Filiale</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 uppercase">CA Jour</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 uppercase">CA Mois</th>
                <th className="px-6 py-3 text-center text-xs font-medium text-neutral-600 uppercase">Ventes</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Marge %</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-neutral-600 uppercase">Créances</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {DONNEES_FILIALES.map((filiale) => (
                <tr key={filiale.code} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-neutral-900">{filiale.nom}</p>
                      <p className="text-xs text-neutral-500">{filiale.code}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-neutral-900">
                    {filiale.ca_jour.toLocaleString('fr-FR')} F
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-bold text-primary-700">
                    {filiale.ca_mois.toLocaleString('fr-FR')} F
                  </td>
                  <td className="px-6 py-4 text-center text-neutral-600">{filiale.nombre_ventes}</td>
                  <td className="px-6 py-4 text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      filiale.marge >= 30 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {filiale.marge}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-mono font-medium text-red-600">
                    {filiale.creances.toLocaleString('fr-FR')} F
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Graphique placeholder */}
      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">
          {isConsolide ? 'Comparaison CA mensuel par filiale' : 'Évolution des ventes - 7 derniers jours'}
        </h3>
        <div className="h-64 bg-neutral-50 rounded-lg border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400">
          {isConsolide ? 'Graphique comparatif (Abidjan, Bouaké, San-Pedro)' : 'Graphique d\'évolution'}
        </div>
      </div>
    </div>
  );
}
