import { useState } from 'react';
import { BanknotesIcon, EyeIcon, MagnifyingGlassIcon, PlusIcon, PrinterIcon, TruckIcon } from '@heroicons/react/24/outline';
import type { Fournisseur } from '../../../core/fournisseurs';
import { FournisseursRepository } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import AchatModal from '../../features/fournisseurs/AchatModal';
import FournisseurDetailsModal from '../../features/fournisseurs/FournisseurDetailsModal';
import FournisseurFormModal from '../../features/fournisseurs/FournisseurFormModal';
import ReglementFournisseurModal from '../../features/fournisseurs/ReglementFournisseurModal';
import { useFournisseurs } from '../../features/fournisseurs/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';

type ModalState = { type: 'creer' } | { type: 'details'; id: string } | { type: 'achat'; f: Fournisseur } | { type: 'reglement'; f: Fournisseur } | null;

/** Fournisseurs de la filiale : dettes, réceptions d'achats, paiements. */
export default function FournisseursPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const [recherche, setRecherche] = useState('');
  const [avecDette, setAvecDette] = useState(false);
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  const { fournisseurs, isLoading } = useFournisseurs(filialeId, { recherche, avecDette, inclureInactifs });
  const totalDettes = fournisseurs.reduce((s, f) => s + Math.max(f.solde_actuel, 0), 0);
  const totalAchats = fournisseurs.reduce((s, f) => s + f.cumul_factures, 0);

  const basculerActif = async (f: Fournisseur) => {
    if (f.est_actif && f.solde_actuel !== 0) { notifier('erreur', "Impossible de désactiver un fournisseur dont le compte n'est pas soldé."); return; }
    if (!confirm(`${f.est_actif ? 'Désactiver' : 'Réactiver'} ${f.raison_sociale} ?`)) return;
    try { await repository.setActif(f.id, !f.est_actif); notifier('succes', `${f.raison_sociale} ${f.est_actif ? 'désactivé' : 'réactivé'}.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.'); }
  };

  if (!filialeId) {
    return <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">{estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div><h1 className="text-2xl font-bold text-neutral-900">Fournisseurs</h1><p className="text-sm text-neutral-500 mt-1">{filiale?.nom} · {fournisseurs.length} fournisseur(s)</p></div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer</button>
          <button onClick={() => setModal({ type: 'creer' })} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Nouveau fournisseur</button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Dettes fournisseurs</p><p className="text-2xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(totalDettes)}</p></div>
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Cumul des achats</p><p className="text-2xl font-bold font-mono mt-1">{formaterFcfa(totalAchats)}</p></div>
        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Fournisseurs à payer</p><p className="text-2xl font-bold mt-1">{fournisseurs.filter((f) => f.solde_actuel > 0).length}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative flex-1 min-w-[16rem] max-w-md"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" /><input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Code, raison sociale ou téléphone…" className={`${inputClass} pl-10`} /></div>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={avecDette} onChange={(e) => setAvecDette(e.target.checked)} className="rounded" /> Avec dette</label>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={inclureInactifs} onChange={(e) => setInclureInactifs(e.target.checked)} className="rounded" /> Inclure les inactifs</label>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
              <th className="px-4 py-3 text-left">Code</th><th className="px-4 py-3 text-left">Raison sociale</th><th className="px-4 py-3 text-left">Famille</th><th className="px-4 py-3 text-left">Téléphone</th>
              <th className="px-4 py-3 text-right">Achats</th><th className="px-4 py-3 text-right">Règlements</th><th className="px-4 py-3 text-right">Dette</th><th className="px-4 py-3 text-center print:hidden">Actions</th>
            </tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {fournisseurs.map((f) => (
                <tr key={f.id} className={`hover:bg-neutral-50 ${!f.est_actif ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 text-sm font-mono text-primary-700">{f.code}</td>
                  <td className="px-4 py-3 text-sm font-medium text-neutral-900">{f.raison_sociale}{!f.est_actif && <span className="ml-2 text-xs text-neutral-500">(inactif)</span>}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{f.famille ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-neutral-600">{f.telephone ?? '—'}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-neutral-600">{formaterFcfa(f.cumul_factures)}</td>
                  <td className="px-4 py-3 text-sm text-right font-mono text-green-700">{formaterFcfa(f.cumul_reglements)}</td>
                  <td className={`px-4 py-3 text-sm text-right font-mono font-bold ${f.solde_actuel > 0 ? 'text-red-600' : 'text-green-700'}`}>{formaterFcfa(f.solde_actuel)}</td>
                  <td className="px-4 py-3 text-center print:hidden"><div className="flex items-center justify-center gap-1">
                    <button onClick={() => setModal({ type: 'details', id: f.id })} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Fiche fournisseur"><EyeIcon className="w-4 h-4" /></button>
                    <button onClick={() => setModal({ type: 'achat', f })} className="p-1.5 hover:bg-primary-50 rounded text-primary-700" title="Réceptionner un achat"><TruckIcon className="w-4 h-4" /></button>
                    <button onClick={() => setModal({ type: 'reglement', f })} className="p-1.5 hover:bg-green-50 rounded text-green-700" title="Payer"><BanknotesIcon className="w-4 h-4" /></button>
                    <button onClick={() => basculerActif(f)} className={`px-2 py-1 rounded text-xs font-medium ${f.est_actif ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>{f.est_actif ? 'Désactiver' : 'Réactiver'}</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && fournisseurs.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun fournisseur.</div>}
      </div>
      {modal?.type === 'creer' && <FournisseurFormModal filialeId={filialeId} onClose={() => setModal(null)} />}
      {modal?.type === 'details' && <FournisseurDetailsModal filialeId={filialeId} fournisseurId={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === 'achat' && <AchatModal filialeId={filialeId} fournisseur={modal.f} onClose={() => setModal(null)} />}
      {modal?.type === 'reglement' && <ReglementFournisseurModal filialeId={filialeId} fournisseur={modal.f} onClose={() => setModal(null)} />}
    </div>
  );
}
