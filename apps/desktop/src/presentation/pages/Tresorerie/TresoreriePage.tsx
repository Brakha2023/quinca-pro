import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowsRightLeftIcon, PencilSquareIcon, PlusIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { LIBELLES_CATEGORIE, type Caisse } from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { controleInlineClass } from '../../components/ui/FormField';
import { CaisseFormModal, OperationModal, TransfertCaisseModal } from '../../features/tresorerie/modales';
import { useCaissesToutes, useMouvementsTresorerie } from '../../features/tresorerie/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
type ModalState = { type: 'caisse'; caisse?: Caisse } | { type: 'operation'; sens: 'RECETTE' | 'DEPENSE' } | { type: 'transfert' } | null;

function formaterDateHeure(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
}

/** Trésorerie de la filiale : soldes des caisses, recettes/dépenses, transferts, journal. */
export default function TresoreriePage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const caisses = useCaissesToutes(filialeId);
  const actives = caisses.filter((c) => c.est_active);
  const [caisseId, setCaisseId] = useState('');
  const [dateDebut, setDateDebut] = useState(aujourdhui);
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [type, setType] = useState<'RECETTE' | 'DEPENSE' | ''>('');
  const [modal, setModal] = useState<ModalState>(null);
  const { mouvements, isLoading } = useMouvementsTresorerie(filialeId, { caisseId: caisseId || null, dateDebut, dateFin, type: type || null });

  const stats = useMemo(() => ({
    recettes: mouvements.filter((m) => m.type === 'RECETTE').reduce((s, m) => s + (m.montant ?? 0), 0),
    depenses: mouvements.filter((m) => m.type === 'DEPENSE').reduce((s, m) => s + (m.montant ?? 0), 0),
    total: actives.reduce((s, c) => s + c.solde_actuel, 0),
  }), [mouvements, actives]);

  const basculer = async (c: Caisse) => {
    if (c.est_active && c.solde_actuel !== 0) { notifier('erreur', 'Videz la caisse (transfert) avant de la désactiver.'); return; }
    try { await repository.setActive(c.id, !c.est_active); notifier('succes', `Caisse ${c.nom} ${c.est_active ? 'désactivée' : 'réactivée'}.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.'); }
  };

  if (!filialeId) {
    return <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">{estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div><h1 className="text-2xl font-bold text-neutral-900">Trésorerie</h1><p className="text-sm text-neutral-500 mt-1">{filiale?.nom} · total en caisses : <strong className="font-mono">{formaterFcfa(stats.total)}</strong></p></div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /></button>
          <button onClick={() => setModal({ type: 'operation', sens: 'RECETTE' })} disabled={actives.length === 0} className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><ArrowDownTrayIcon className="w-5 h-5" /> Recette</button>
          <button onClick={() => setModal({ type: 'operation', sens: 'DEPENSE' })} disabled={actives.length === 0} className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><ArrowUpTrayIcon className="w-5 h-5" /> Dépense</button>
          <button onClick={() => setModal({ type: 'transfert' })} disabled={actives.length < 2} className="flex items-center gap-2 px-3 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><ArrowsRightLeftIcon className="w-5 h-5" /> Transfert</button>
          <button onClick={() => setModal({ type: 'caisse' })} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Caisse</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {caisses.map((c) => (
          <button key={c.id} onClick={() => setCaisseId(caisseId === c.id ? '' : c.id)} className={`text-left bg-white p-5 rounded-xl border-2 shadow-sm transition-colors ${caisseId === c.id ? 'border-primary-500' : 'border-neutral-200 hover:border-primary-300'} ${!c.est_active ? 'opacity-50' : ''}`}>
            <div className="flex items-start justify-between">
              <div><p className="text-xs font-mono text-neutral-500">{c.code}</p><p className="font-semibold text-neutral-900">{c.nom}</p><p className="text-xs text-neutral-500">{c.responsable || '—'}</p></div>
              <div className="flex gap-1">
                <span role="button" onClick={(e) => { e.stopPropagation(); setModal({ type: 'caisse', caisse: c }); }} className="p-1 rounded hover:bg-neutral-100 text-neutral-500" title="Modifier"><PencilSquareIcon className="w-4 h-4" /></span>
                <span role="button" onClick={(e) => { e.stopPropagation(); basculer(c); }} className="px-1.5 py-0.5 rounded text-xs text-neutral-500 hover:bg-neutral-100">{c.est_active ? 'Désactiver' : 'Réactiver'}</span>
              </div>
            </div>
            <p className={`text-2xl font-bold font-mono mt-3 ${c.solde_actuel < 0 ? 'text-red-600' : 'text-primary-700'}`}>{formaterFcfa(c.solde_actuel)}</p>
          </button>
        ))}
        {caisses.length === 0 && <p className="text-sm text-neutral-400 col-span-full">Aucune caisse : créez-en une pour encaisser.</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} /><span className="text-neutral-400">→</span>
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} />
        <button onClick={() => { setDateDebut(aujourdhui()); setDateFin(aujourdhui()); }} className="text-sm text-primary-700 hover:underline">Aujourd'hui</button>
        <select value={type} onChange={(e) => setType(e.target.value as typeof type)} className={controleInlineClass}><option value="">Recettes et dépenses</option><option value="RECETTE">Recettes</option><option value="DEPENSE">Dépenses</option></select>
        <span className="ml-auto text-sm text-neutral-600">Recettes <strong className="font-mono text-green-700">{formaterFcfa(stats.recettes)}</strong> · Dépenses <strong className="font-mono text-orange-700">{formaterFcfa(stats.depenses)}</strong> · Solde <strong className={`font-mono ${stats.recettes - stats.depenses < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(stats.recettes - stats.depenses)}</strong></span>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
            <th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Caisse</th><th className="px-3 py-3 text-left">Catégorie</th><th className="px-3 py-3 text-left">Description</th><th className="px-3 py-3 text-left">Référence</th><th className="px-3 py-3 text-left">Par</th><th className="px-3 py-3 text-right">Recette</th><th className="px-3 py-3 text-right">Dépense</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {mouvements.map((m) => (
              <tr key={m.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(m.date_operation)}</td>
                <td className="px-3 py-2 text-sm">{m.caisse_nom}</td>
                <td className="px-3 py-2 text-sm"><span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100">{LIBELLES_CATEGORIE[m.categorie ?? ''] ?? m.categorie}</span></td>
                <td className="px-3 py-2 text-sm text-neutral-600 max-w-xs truncate" title={m.description ?? ''}>{m.description ?? '—'}</td>
                <td className="px-3 py-2 text-sm font-mono text-neutral-600">{m.reference ?? '—'}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{[m.utilisateur_prenom, m.utilisateur_nom].filter(Boolean).join(' ') || '—'}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{m.type === 'RECETTE' ? formaterFcfa(m.montant) : ''}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-orange-700">{m.type === 'DEPENSE' ? formaterFcfa(m.montant) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && mouvements.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun mouvement sur la période.</div>}
      </div>

      {modal?.type === 'caisse' && <CaisseFormModal filialeId={filialeId} caisse={modal.caisse} onClose={() => setModal(null)} />}
      {modal?.type === 'operation' && <OperationModal filialeId={filialeId} caisses={actives} type={modal.sens} onClose={() => setModal(null)} />}
      {modal?.type === 'transfert' && <TransfertCaisseModal filialeId={filialeId} caisses={actives} onClose={() => setModal(null)} />}
    </div>
  );
}
