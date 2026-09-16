import { useMemo, useState } from 'react';
import { useQuery } from '@powersync/react';
import type { AuditLogRow } from '@quinca/shared-types';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { controleInlineClass } from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';

const LIBELLES_ACTION: Record<string, { label: string; cls: string }> = {
  INSERT: { label: 'Création', cls: 'bg-green-100 text-green-700' },
  UPDATE: { label: 'Modification', cls: 'bg-blue-100 text-blue-700' },
  DELETE: { label: 'Suppression', cls: 'bg-red-100 text-red-700' },
};
const TABLES_AUDITEES = ['articles', 'ventes', 'reglements_clients', 'reglements_fournisseurs', 'mouvements_stock', 'mouvements_tresorerie', 'utilisateurs'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

interface AuditVue extends AuditLogRow { utilisateur_nom: string | null; utilisateur_prenom: string | null; utilisateur_email: string | null }

function auditQuery(filialeId: string | null, f: { table: string; action: string; dateDebut: string; dateFin: string; utilisateurId: string }) {
  const conditions = ['(l.filiale_id = ? OR l.filiale_id IS NULL)'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (f.table) { conditions.push('l.table_cible = ?'); params.push(f.table); }
  if (f.action) { conditions.push('l.action = ?'); params.push(f.action); }
  if (f.utilisateurId) { conditions.push('l.utilisateur_id = ?'); params.push(f.utilisateurId); }
  if (f.dateDebut) { conditions.push('l.created_at >= ?'); params.push(new Date(`${f.dateDebut}T00:00:00`).toISOString()); }
  if (f.dateFin) { conditions.push('l.created_at <= ?'); params.push(new Date(`${f.dateFin}T23:59:59.999`).toISOString()); }
  return {
    sql: `SELECT l.*, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom, u.email AS utilisateur_email
          FROM audit_log l LEFT JOIN utilisateurs u ON u.id = l.utilisateur_id WHERE ${conditions.join(' AND ')} ORDER BY l.created_at DESC LIMIT 500`,
    params,
  };
}

function difference(avant: string | null, apres: string | null): Array<[string, unknown, unknown]> {
  const a = avant ? (JSON.parse(avant) as Record<string, unknown>) : {};
  const b = apres ? (JSON.parse(apres) as Record<string, unknown>) : {};
  const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...cles].filter((k) => k !== 'updated_at' && JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => [k, a[k], b[k]]);
}

/**
 * Journal d'audit : alimenté exclusivement par les triggers Postgres
 * (jamais par le client), synchronisé en lecture seule.
 */
export default function AuditPage() {
  const { filialeId, filiale } = useFilialeCourante();
  const [table, setTable] = useState('');
  const [action, setAction] = useState('');
  const [dateDebut, setDateDebut] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().slice(0, 10); });
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [detail, setDetail] = useState<AuditVue | null>(null);
  const { data: utilisateurs } = useQuery<{ id: string; nom: string; prenom: string | null }>('SELECT id, nom, prenom FROM utilisateurs ORDER BY nom');
  const [utilisateurId, setUtilisateurId] = useState('');
  const { sql, params } = useMemo(() => auditQuery(filialeId, { table, action, dateDebut, dateFin, utilisateurId }), [filialeId, table, action, dateDebut, dateFin, utilisateurId]);
  const { data: logs, isLoading } = useQuery<AuditVue>(sql, params);

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-neutral-900">Journal d'audit</h1><p className="text-sm text-neutral-500 mt-1">{filiale?.nom ?? 'Toutes les filiales'} · enregistré côté serveur, infalsifiable depuis l'application</p></div>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} /><span className="text-neutral-400">→</span>
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} />
        <select value={table} onChange={(e) => setTable(e.target.value)} className={controleInlineClass}><option value="">Toutes les tables</option>{TABLES_AUDITEES.map((t) => <option key={t} value={t}>{t}</option>)}</select>
        <select value={action} onChange={(e) => setAction(e.target.value)} className={controleInlineClass}><option value="">Toutes les actions</option>{Object.entries(LIBELLES_ACTION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select value={utilisateurId} onChange={(e) => setUtilisateurId(e.target.value)} className={controleInlineClass}><option value="">Tous les utilisateurs</option>{utilisateurs.map((u) => <option key={u.id} value={u.id}>{[u.prenom, u.nom].filter(Boolean).join(' ')}</option>)}</select>
        <span className="ml-auto text-sm text-neutral-600">{logs.length} événement(s)</span>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Utilisateur</th><th className="px-3 py-3 text-left">Action</th><th className="px-3 py-3 text-left">Table</th><th className="px-3 py-3 text-left">Enregistrement</th><th className="px-3 py-3 text-left">Changements</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {logs.map((l) => {
              const a = LIBELLES_ACTION[l.action ?? ''] ?? { label: l.action ?? '', cls: 'bg-neutral-100' };
              const diff = l.action === 'UPDATE' ? difference(l.anciennes_valeurs, l.nouvelles_valeurs) : [];
              return (
                <tr key={l.id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => setDetail(l)}>
                  <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''}</td>
                  <td className="px-3 py-2 text-sm">{[l.utilisateur_prenom, l.utilisateur_nom].filter(Boolean).join(' ') || l.utilisateur_email || <span className="text-neutral-400">système</span>}</td>
                  <td className="px-3 py-2"><span className={`px-2 py-1 rounded-full text-xs font-medium ${a.cls}`}>{a.label}</span></td>
                  <td className="px-3 py-2 text-sm font-mono">{l.table_cible}</td>
                  <td className="px-3 py-2 text-xs font-mono text-neutral-500">{(l.enregistrement_id ?? '').slice(0, 8)}…</td>
                  <td className="px-3 py-2 text-xs text-neutral-600">{diff.length ? diff.slice(0, 3).map(([k]) => k).join(', ') + (diff.length > 3 ? '…' : '') : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && logs.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun événement sur la période.</div>}
      </div>
      {detail && (
        <Modal titre={`${LIBELLES_ACTION[detail.action ?? '']?.label ?? detail.action} · ${detail.table_cible}`} sousTitre={detail.enregistrement_id ?? ''} largeur="max-w-3xl" onClose={() => setDetail(null)}>
          {detail.action === 'UPDATE' ? (
            <table className="w-full text-sm"><thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Champ</th><th className="px-3 py-2 text-left">Avant</th><th className="px-3 py-2 text-left">Après</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">{difference(detail.anciennes_valeurs, detail.nouvelles_valeurs).map(([k, a, b]) => <tr key={k}><td className="px-3 py-2 font-mono">{k}</td><td className="px-3 py-2 text-red-700 font-mono break-all">{String(a ?? '∅')}</td><td className="px-3 py-2 text-green-700 font-mono break-all">{String(b ?? '∅')}</td></tr>)}</tbody></table>
          ) : (
            <pre className="text-xs bg-neutral-50 rounded-lg p-4 overflow-x-auto">{JSON.stringify(JSON.parse(detail.nouvelles_valeurs ?? detail.anciennes_valeurs ?? '{}'), null, 2)}</pre>
          )}
        </Modal>
      )}
    </div>
  );
}
