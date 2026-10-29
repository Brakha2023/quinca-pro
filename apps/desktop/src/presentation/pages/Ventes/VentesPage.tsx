import { useMemo, useState } from 'react';
import { CheckIcon, EyeIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { STATUTS_VENTE, type ModePaiement, type StatutVente } from '@quinca/shared-types';
import { LIBELLES_MODE_PAIEMENT, LIBELLES_STATUT_VENTE, recapJournalVentes } from '../../../core/ventes';
import { VentesRepository, type VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';
import { usePermissions } from '../../auth/usePermissions';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import NoteHistorique from '../../components/ui/NoteHistorique';
import ChampMontant from '../../components/ui/ChampMontant';
import { controleInlineClass } from '../../components/ui/FormField';
import { useCaisses } from '../../features/clients/hooks';
import JournalVentesDocument from '../../features/ventes/JournalVentesDocument';
import VenteDetailsModal, { STATUT_VENTE_STYLE, formaterDateHeure } from '../../features/ventes/VenteDetailsModal';
import { useVentes } from '../../features/ventes/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useConfirmation } from '../../confirmation/useConfirmation';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Ventes de la filiale : journée de caisse, validation de fin de journée, historique, annulations. */
export default function VentesPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { peut } = usePermissions();
  const repository = useRepository(VentesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const caisses = useCaisses(filialeId);

  const [dateDebut, setDateDebut] = useState(aujourdhui);
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [caisseId, setCaisseId] = useState('');
  const [statut, setStatut] = useState<StatutVente | ''>('');
  const [recherche, setRecherche] = useState('');
  /** Montant TTC cherché, en francs ; 0 = aucun filtre. */
  const [montantTtc, setMontantTtc] = useState(0);
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<VenteVueRow | null>(null);
  const [apercu, setApercu] = useState(false);

  const { ventes, isLoading } = useVentes(filialeId, { dateDebut, dateFin, caisseId: caisseId || null, statut: statut || null, recherche, montantTtc });
  const peutValider = peut('ventes.valider');

  // Les mêmes totaux que le journal imprimé : une seule règle, dans `core/ventes`.
  const stats = useMemo(() => recapJournalVentes(ventes), [ventes]);

  const enAttenteIds = ventes.filter((v) => v.statut === 'EN_ATTENTE').map((v) => v.id);
  const toutSelectionne = enAttenteIds.length > 0 && enAttenteIds.every((id) => selection.has(id));

  const validerSelection = async () => {
    const ids = [...selection].filter((id) => enAttenteIds.includes(id));
    if (ids.length === 0) return;
    if (!(await confirmer({ titre: 'Validation de journée', message: `Valider ${ids.length} vente(s) ? Elles ne pourront plus être annulées depuis l'application.`, libelleConfirmer: 'Valider' }))) return;
    try {
      const n = await repository.valider(ids);
      notifier('succes', `${n} vente(s) validée(s).`);
      setSelection(new Set());
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Validation impossible.');
    }
  };

  if (!filialeId) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm text-center py-16 text-neutral-400">
        {estVueConsolidee ? <p className="text-lg">Sélectionnez une filiale dans le menu latéral.</p> : <p>Profil utilisateur en cours de synchronisation…</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900">Ventes</h1>
          <p className="text-sm text-neutral-500 mt-1">{filiale?.nom} · journée de caisse et historique</p>
          <NoteHistorique quoi="les ventes" />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setApercu(true)} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg" data-testid="imprimer-journal-ventes"><PrinterIcon className="w-5 h-5" /> Imprimer</button>
          {peutValider && (
            <button onClick={validerSelection} disabled={selection.size === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">
              <CheckIcon className="w-5 h-5" /> Valider ({[...selection].filter((id) => enAttenteIds.includes(id)).length})
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Chiffre d'affaires TTC</p><p className="text-xl font-bold font-mono text-primary-700 mt-1">{formaterFcfa(stats.chiffre_affaires)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Ventes</p><p className="text-xl font-bold mt-1">{stats.nombre}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Encaissé</p><p className="text-xl font-bold font-mono text-green-700 mt-1">{formaterFcfa(stats.encaisse)}</p><p className="text-xs text-neutral-500 mt-1">{stats.par_mode.map((m) => `${LIBELLES_MODE_PAIEMENT[m.mode as ModePaiement] ?? m.mode} ${formaterFcfa(m.montant)}`).join(' · ')}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">Vendu à crédit</p><p className="text-xl font-bold font-mono text-orange-700 mt-1">{formaterFcfa(stats.credit)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-xs text-neutral-500">En attente de validation</p><p className={`text-xl font-bold mt-1 ${stats.en_attente ? 'text-orange-700' : ''}`}>{stats.en_attente}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} />
        <span className="text-neutral-400">→</span>
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} />
        <button onClick={() => { setDateDebut(aujourdhui()); setDateFin(aujourdhui()); }} className="text-sm text-primary-700 hover:underline">Aujourd'hui</button>
        <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)} className={controleInlineClass}><option value="">Toutes les caisses</option>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutVente | '')} className={controleInlineClass}><option value="">Tous les statuts</option>{STATUTS_VENTE.map((s) => <option key={s} value={s}>{LIBELLES_STATUT_VENTE[s]}</option>)}</select>
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° ticket ou client…" className={`${controleInlineClass} w-56`} />
        {/* Un client ne retient pas un numéro de ticket ; il retient ce qu'il a payé. */}
        <ChampMontant
          valeur={montantTtc}
          onChange={setMontantTtc}
          zeroVide
          placeholder="Montant TTC…"
          aria-label="Montant TTC"
          data-testid="filtre-montant"
          className={`${controleInlineClass} w-40 text-right font-mono`}
        />
        {montantTtc > 0 && (
          <button onClick={() => setMontantTtc(0)} className="text-sm text-primary-700 hover:underline" data-testid="effacer-filtre-montant">Effacer le montant</button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                {peutValider && <th className="px-3 py-3 print:hidden"><input type="checkbox" checked={toutSelectionne} onChange={(e) => setSelection(e.target.checked ? new Set(enAttenteIds) : new Set())} className="rounded" /></th>}
                <th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Ticket</th><th className="px-3 py-3 text-left">Client</th><th className="px-3 py-3 text-left">Caisse</th><th className="px-3 py-3 text-left">Vendeur</th>
                <th className="px-3 py-3 text-right">Total TTC</th><th className="px-3 py-3 text-right">Perçu</th><th className="px-3 py-3 text-right">Reste dû</th><th className="px-3 py-3 text-left">Mode</th><th className="px-3 py-3 text-center">Statut</th><th className="px-3 py-3 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {ventes.map((v) => {
                const st = (v.statut ?? 'EN_ATTENTE') as StatutVente;
                return (
                  <tr key={v.id} className={`hover:bg-neutral-50 ${st === 'ANNULEE' ? 'opacity-50' : ''}`}>
                    {peutValider && <td className="px-3 py-2 print:hidden">{st === 'EN_ATTENTE' && <input type="checkbox" checked={selection.has(v.id)} onChange={(e) => setSelection((s) => { const n = new Set(s); if (e.target.checked) n.add(v.id); else n.delete(v.id); return n; })} className="rounded" />}</td>}
                    <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(v.date_vente)}</td>
                    <td className="px-3 py-2 text-sm font-mono text-primary-700">{v.numero}</td>
                    <td className="px-3 py-2 text-sm">{v.client_nom ?? <span className="text-neutral-400">Comptoir</span>}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{v.caisse_nom}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{[v.utilisateur_prenom, v.utilisateur_nom].filter(Boolean).join(' ')}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{formaterFcfa(v.total_ttc)}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{formaterFcfa((v.montant_percu ?? 0) - (v.monnaie ?? 0))}</td>
                    <td className={`px-3 py-2 text-sm text-right font-mono ${v.reste_a_payer ? 'text-orange-700' : 'text-neutral-400'}`}>{formaterFcfa(v.reste_a_payer)}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{LIBELLES_MODE_PAIEMENT[(v.mode_paiement ?? 'ESPECES') as ModePaiement]}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_VENTE_STYLE[st]}`}>{LIBELLES_STATUT_VENTE[st]}</span></td>
                    <td className="px-3 py-2 text-center print:hidden"><button onClick={() => setDetail(v)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Détail"><EyeIcon className="w-4 h-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && ventes.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune vente sur la période.</div>}
      </div>

      {apercu && (
        <JournalVentesDocument
          ventes={ventes}
          filiale={{ nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone }}
          filtres={{
            dateDebut, dateFin,
            caisseNom: caisses.find((c) => c.id === caisseId)?.nom ?? null,
            statutLabel: statut ? LIBELLES_STATUT_VENTE[statut] : null,
            recherche,
            montantTtc,
          }}
          onClose={() => setApercu(false)}
        />
      )}

      {detail && <VenteDetailsModal vente={detail} filialeId={filialeId} peutAnnuler={peutValider} onClose={() => setDetail(null)} />}
    </div>
  );
}
