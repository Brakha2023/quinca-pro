import { useMemo, useState } from 'react';
import { useQuery } from '@powersync/react';
import { MagnifyingGlassIcon, PencilSquareIcon, TruckIcon } from '@heroicons/react/24/outline';
import { STATUTS_LIVRAISON, type StatutLivraison } from '@quinca/shared-types';
import { livraisonDemandeSchema, type LivraisonDemande } from '../../../core/ventes';
import { LivraisonsRepository, TRANSITIONS_LIVRAISON, livraisonsQuery, type LivraisonVueRow } from '../../../infrastructure/powersync/repositories/LivraisonsRepository';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa, formaterDate } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useConfirmation } from '../../confirmation/useConfirmation';

const LIBELLES: Record<StatutLivraison, string> = { A_PREPARER: 'À préparer', EN_COURS: 'En cours', LIVREE: 'Livrée', ANNULEE: 'Annulée' };
const STYLES: Record<StatutLivraison, string> = { A_PREPARER: 'bg-orange-100 text-orange-700', EN_COURS: 'bg-blue-100 text-blue-700', LIVREE: 'bg-green-100 text-green-700', ANNULEE: 'bg-red-100 text-red-700' };

function EditionModal({ livraison, onClose }: { livraison: LivraisonVueRow; onClose: () => void }) {
  const repository = useRepository(LivraisonsRepository);
  const notifier = useNotifier();
  const [form, setForm] = useState<LivraisonDemande>({
    adresse_livraison: livraison.adresse_livraison ?? '', date_livraison_prevue: (livraison.date_livraison_prevue ?? '').slice(0, 10), chauffeur: livraison.chauffeur ?? '', vehicule: livraison.vehicule ?? '',
  });
  const valider = async () => {
    const parsed = livraisonDemandeSchema.safeParse(form);
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    try { await repository.modifier(livraison.id, parsed.data); notifier('succes', `Livraison ${livraison.numero} modifiée.`); onClose(); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Modification impossible.'); }
  };
  return (
    <Modal titre={`Livraison ${livraison.numero}`} largeur="max-w-lg" onClose={onClose} pied={<><button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button><button type="button" onClick={valider} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Enregistrer</button></>}>
      <div className="space-y-4">
        <label className="block text-xs font-medium text-neutral-700">Adresse<input value={form.adresse_livraison} onChange={(e) => setForm({ ...form, adresse_livraison: e.target.value })} className={`${inputClass} mt-1`} /></label>
        <div className="grid grid-cols-3 gap-4">
          <label className="block text-xs font-medium text-neutral-700">Date prévue<input type="date" value={form.date_livraison_prevue} onChange={(e) => setForm({ ...form, date_livraison_prevue: e.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="block text-xs font-medium text-neutral-700">Chauffeur<input value={form.chauffeur} onChange={(e) => setForm({ ...form, chauffeur: e.target.value })} className={`${inputClass} mt-1`} /></label>
          <label className="block text-xs font-medium text-neutral-700">Véhicule<input value={form.vehicule} onChange={(e) => setForm({ ...form, vehicule: e.target.value })} className={`${inputClass} mt-1`} /></label>
        </div>
      </div>
    </Modal>
  );
}

/** Suivi des livraisons créées depuis le point de vente. */
export default function LivraisonsPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const repository = useRepository(LivraisonsRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const [statut, setStatut] = useState<StatutLivraison | ''>('');
  const [recherche, setRecherche] = useState('');
  const [edition, setEdition] = useState<LivraisonVueRow | null>(null);
  const { sql, params } = useMemo(() => livraisonsQuery(filialeId, statut || null, recherche), [filialeId, statut, recherche]);
  const { data: livraisons, isLoading } = useQuery<LivraisonVueRow>(sql, params);
  const compte = (s: StatutLivraison) => livraisons.filter((l) => l.statut === s).length;

  const changer = async (l: LivraisonVueRow, s: StatutLivraison) => {
    if (s === 'ANNULEE' && !(await confirmer({ message: `Annuler la livraison ${l.numero} ?`, libelleConfirmer: 'Annuler la livraison', danger: true }))) return;
    try { await repository.changerStatut(l.id, s); notifier('succes', `Livraison ${l.numero} : ${LIBELLES[s]}.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Changement impossible.'); }
  };

  if (!filialeId) {
    return <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">{estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}</div>;
  }

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold text-neutral-900">Livraisons</h1><p className="text-sm text-neutral-500 mt-1">{filiale?.nom} · les bons sont créés depuis le point de vente</p></div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STATUTS_LIVRAISON.map((s) => (
          <button key={s} onClick={() => setStatut(statut === s ? '' : s)} className={`bg-white p-4 rounded-xl border-2 text-left shadow-sm ${statut === s ? 'border-primary-500' : 'border-neutral-200'}`}><p className="text-xs text-neutral-500">{LIBELLES[s]}</p><p className="text-2xl font-bold mt-1">{statut && statut !== s ? '—' : compte(s)}</p></button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <div className="relative flex-1 min-w-[16rem] max-w-md"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" /><input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° livraison, client, adresse, chauffeur…" className={`${inputClass} pl-10`} /></div>
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutLivraison | '')} className={controleInlineClass}><option value="">Tous les statuts</option>{STATUTS_LIVRAISON.map((s) => <option key={s} value={s}>{LIBELLES[s]}</option>)}</select>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
            <th className="px-3 py-3 text-left">Numéro</th><th className="px-3 py-3 text-left">Prévue</th><th className="px-3 py-3 text-left">Client</th><th className="px-3 py-3 text-left">Adresse</th><th className="px-3 py-3 text-left">Chauffeur / véhicule</th><th className="px-3 py-3 text-left">Ticket</th><th className="px-3 py-3 text-right">Montant</th><th className="px-3 py-3 text-center">Statut</th><th className="px-3 py-3 text-center print:hidden">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {livraisons.map((l) => {
              const s = (l.statut ?? 'A_PREPARER') as StatutLivraison;
              return (
                <tr key={l.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-sm font-mono text-primary-700">{l.numero}</td>
                  <td className="px-3 py-2 text-sm">{formaterDate(l.date_livraison_prevue)}{l.date_livraison_reelle && <span className="block text-xs text-green-700">livrée le {formaterDate(l.date_livraison_reelle)}</span>}</td>
                  <td className="px-3 py-2 text-sm">{l.client_nom ?? <span className="text-neutral-400">Comptoir</span>}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600 max-w-xs truncate" title={l.adresse_livraison ?? ''}>{l.adresse_livraison}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{[l.chauffeur, l.vehicule].filter(Boolean).join(' · ') || '—'}</td>
                  <td className="px-3 py-2 text-sm font-mono text-neutral-600">{l.vente_numero ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{l.vente_total_ttc != null ? formaterFcfa(l.vente_total_ttc) : '—'}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STYLES[s]}`}>{LIBELLES[s]}</span></td>
                  <td className="px-3 py-2 print:hidden"><div className="flex items-center justify-center gap-1 flex-wrap">
                    {TRANSITIONS_LIVRAISON[s].map((cible) => (
                      <button key={cible} onClick={() => changer(l, cible)} className={`px-2 py-1 rounded text-xs font-medium ${cible === 'ANNULEE' ? 'text-red-600 hover:bg-red-50' : cible === 'LIVREE' ? 'text-green-700 hover:bg-green-50' : 'text-primary-700 hover:bg-primary-50'}`}>
                        {cible === 'EN_COURS' && <TruckIcon className="w-3.5 h-3.5 inline mr-1" />}{LIBELLES[cible]}
                      </button>
                    ))}
                    {s !== 'LIVREE' && <button onClick={() => setEdition(l)} className="p-1.5 hover:bg-neutral-100 rounded text-neutral-500" title="Modifier"><PencilSquareIcon className="w-4 h-4" /></button>}
                  </div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && livraisons.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune livraison.</div>}
      </div>
      {edition && <EditionModal livraison={edition} onClose={() => setEdition(null)} />}
    </div>
  );
}
