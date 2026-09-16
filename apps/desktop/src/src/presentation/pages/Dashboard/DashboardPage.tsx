export default function DashboardPage() {
  const kpis = [
    { label: 'CA du jour', value: '1 250 000 FCFA', color: 'text-neutral-900' },
    { label: 'Nombre de ventes', value: '42', color: 'text-neutral-900' },
    { label: 'Alertes stock', value: '3 articles', color: 'text-orange-600' },
    { label: 'Créances clients', value: '850 000 FCFA', color: 'text-red-600' },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-sm font-medium text-neutral-500">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-2 font-mono ${kpi.color}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
      
      {/* Placeholder for Charts/Tables */}
      <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
        <h3 className="text-lg font-semibold text-neutral-800 mb-4">Activité récente des filiales</h3>
        <div className="h-64 bg-neutral-50 rounded-lg border border-dashed border-neutral-300 flex items-center justify-center text-neutral-400">
          Graphique comparatif (Abidjan, Bouaké, San-Pedro) à intégrer ici
        </div>
      </div>
    </div>
  );
}