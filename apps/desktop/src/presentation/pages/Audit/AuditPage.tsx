import { useState } from 'react';
import { useAuditStore } from '../../stores/audits.store';
import { TrashIcon, PrinterIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

const ACTION_ICONS: Record<string, string> = {
  CREATE: '🟢', UPDATE: '🔵', DELETE: '',
  LOGIN: '🔑', LOGOUT: '🚪',
  SALE: '💰', STOCK_IN: '', STOCK_OUT: '📤',
  TRANSFER: '🔄', PAYMENT: '💵',
  IMPORT: '📂', EXPORT: '📤', PRINT: '🖨️',
};

export default function AuditPage() {
  const store = useAuditStore();
  const logs = store.getLogsFiltres();
  const [showDetails, setShowDetails] = useState<string | null>(null);

  const users = ['Tous', ...Array.from(new Set(logs.map(l => l.user_name)))];
  const modules = ['Tous', ...Array.from(new Set(logs.map(l => l.module)))];

  const handleExport = () => {
    const csv = [
      ['Date/Heure', 'Utilisateur', 'Action', 'Module', 'Description'],
      ...logs.map(l => [
        l.timestamp, l.user_name, l.action, l.module, l.description
      ])
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Journal d'Audit</h1>
          <p className="text-sm text-neutral-500 mt-1">
            Traçabilité des actions • {logs.length} opérations enregistrées
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"
          >
            <PrinterIcon className="w-5 h-5" />
            Imprimer
          </button>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Exporter CSV
          </button>
          <button
            onClick={store.clearLogs}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
          >
            <TrashIcon className="w-5 h-5" />
            Effacer logs
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Total opérations</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{logs.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Aujourd'hui</p>
          <p className="text-2xl font-bold text-primary-700 mt-2">
            {logs.filter(l => l.timestamp.startsWith(new Date().toISOString().split('T')[0])).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Utilisateurs actifs</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{users.length - 1}</p>
        </div>
        <div className="bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
          <p className="text-sm text-neutral-500">Modules utilisés</p>
          <p className="text-2xl font-bold text-neutral-900 mt-2">{modules.length - 1}</p>
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Utilisateur</label>
            <select
              value={store.filtreUser}
              onChange={(e) => store.setFiltres({ filtreUser: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
            >
              {users.map(u => <option key={u}>{u}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Module</label>
            <select
              value={store.filtreModule}
              onChange={(e) => store.setFiltres({ filtreModule: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
            >
              {modules.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Date début</label>
            <input
              type="date"
              value={store.filtreDateDebut}
              onChange={(e) => store.setFiltres({ filtreDateDebut: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Date fin</label>
            <input
              type="date"
              value={store.filtreDateFin}
              onChange={(e) => store.setFiltres({ filtreDateFin: e.target.value })}
              className="w-full px-3 py-2 border border-neutral-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="hidden print:block px-6 py-4 border-b border-neutral-200">
          <h2 className="text-xl font-bold text-neutral-900">Journal d'Audit</h2>
          <p className="text-sm text-neutral-600 mt-1">Periode: {store.filtreDateDebut || 'Debut'} au {store.filtreDateFin || 'Aujourd\'hui'}</p>
        </div>
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Date/Heure</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Action</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Module</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Utilisateur</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-neutral-600 uppercase">Description</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-neutral-600 uppercase print:hidden">Détails</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-neutral-50 transition-colors">
                <td className="px-4 py-3 text-sm font-mono text-neutral-600">
                  <div>{log.timestamp.split(' ')[0]}</div>
                  <div className="text-xs text-neutral-400">{log.timestamp.split(' ')[1]}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-700">
                    <span>{ACTION_ICONS[log.action] || ''}</span>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-neutral-700">{log.module}</td>
                <td className="px-4 py-3 text-sm font-medium text-neutral-900">{log.user_name}</td>
                <td className="px-4 py-3 text-sm text-neutral-600">{log.description}</td>
                <td className="px-4 py-3 text-center print:hidden">
                  <button
                    onClick={() => setShowDetails(showDetails === log.id ? null : log.id)}
                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                  >
                    {showDetails === log.id ? 'Masquer' : 'Voir'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Détails */}
      {showDetails && logs.find(l => l.id === showDetails) && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 print:hidden">
          <h3 className="font-semibold text-neutral-900 mb-4">Détails de l'opération</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-neutral-500">Type d'entité</p>
              <p className="font-medium">{logs.find(l => l.id === showDetails)?.entity_type || 'N/A'}</p>
            </div>
            <div>
              <p className="text-neutral-500">ID Entité</p>
              <p className="font-mono">{logs.find(l => l.id === showDetails)?.entity_id || 'N/A'}</p>
            </div>
            {logs.find(l => l.id === showDetails)?.old_value && (
              <div className="col-span-2">
                <p className="text-neutral-500">Anciennes valeurs</p>
                <pre className="bg-red-50 p-3 rounded-lg text-xs mt-1 text-red-700">
                  {JSON.stringify(logs.find(l => l.id === showDetails)?.old_value, null, 2)}
                </pre>
              </div>
            )}
            {logs.find(l => l.id === showDetails)?.new_value && (
              <div className="col-span-2">
                <p className="text-neutral-500">Nouvelles valeurs</p>
                <pre className="bg-green-50 p-3 rounded-lg text-xs mt-1 text-green-700">
                  {JSON.stringify(logs.find(l => l.id === showDetails)?.new_value, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:p-0, .print\\:p-0 * { visibility: visible; }
          .print\\:p-0 {
            position: absolute;
            left: 0; top: 0; width: 100%;
            padding: 20px;
          }
        }
      `}</style>
    </div>
  );
}
