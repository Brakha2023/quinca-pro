import { useMemo, useState } from 'react';
import {
  CheckIcon, ClockIcon, EyeIcon, NoSymbolIcon, PlusIcon, ReceiptPercentIcon, WalletIcon,
} from '@heroicons/react/24/outline';
import { STATUTS_DEPENSE, type StatutDepense } from '@quinca/shared-types';
import { LIBELLES_STATUT_DEPENSE, recapJournalDepenses } from '../../../core/depenses';
import { DepensesRepository } from '../../../infrastructure/powersync/repositories/DepensesRepository';
import Carte from '../../components/ui/Carte';
import Indicateur from '../../components/ui/Indicateur';
import NoteHistorique from '../../components/ui/NoteHistorique';
import Pagination from '../../components/ui/Pagination';
import { controleInlineClass } from '../../components/ui/FormField';
import { useAuth } from '../../auth/useAuth';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { usePermissions } from '../../auth/usePermissions';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useCaisses } from '../../features/clients/hooks';
import DepenseDetailsModal, { STATUT_DEPENSE_STYLE, formaterDateHeure } from '../../features/depenses/DepenseDetailsModal';
import DepenseFormModal from '../../features/depenses/DepenseFormModal';
import { useDepenses, type DepenseVue } from '../../features/depenses/hooks';
import { usePagination } from '../../hooks/usePagination';
import { useRepository } from '../../hooks/useRepository';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Dépenses de la filiale : on les engage, on les approuve, on les refuse.
 *
 * L'écran suit le menu Ventes : une dépense attend d'abord une décision, et
 * c'est l'approbation qui fait **sortir** l'argent de la caisse — comme la
 * validation d'une vente le fait entrer. Tant qu'une dépense attend, la caisse
 * ne bouge pas, et la pièce se corrige ou se refuse sans rien contre-passer.
 */
export default function DepensesPage() {
  const { filialeId, filiale, estVueConsolidee } = useFilialeCourante();
  const { utilisateurId } = useAuth();
  const { peut } = usePermissions();
  const repository = useRepository(DepensesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const caisses = useCaisses(filialeId);

  const [dateDebut, setDateDebut] = useState(aujourdhui);
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [caisseId, setCaisseId] = useState('');
  const [statut, setStatut] = useState<StatutDepense | ''>('');
  const [recherche, setRecherche] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<DepenseVue | null>(null);
  const [saisie, setSaisie] = useState(false);

  const { depenses, isLoading } = useDepenses(filialeId, { dateDebut, dateFin, caisseId: caisseId || null, statut: statut || null, recherche });
  const pages = usePagination(depenses.length, [dateDebut, dateFin, caisseId, statut, recherche]);
  const affichees = pages.trancher(depenses);

  const peutValider = peut('depenses.valider');
  const peutSaisir = peut('tresorerie.mouvement');
  const stats = useMemo(() => recapJournalDepenses(depenses), [depenses]);

  const enAttenteIds = depenses.filter((d) => d.statut === 'EN_ATTENTE').map((d) => d.id);
  const toutSelectionne = enAttenteIds.length > 0 && enAttenteIds.every((id) => selection.has(id));
  const retenues = depenses.filter((d) => selection.has(d.id) && d.statut === 'EN_ATTENTE');

  const approuverSelection = async () => {
    if (retenues.length === 0) return;
    const total = retenues.reduce((s, d) => s + d.montant, 0);
    // Dire le montant avant de l'autoriser : c'est le geste qui vide la caisse.
    if (!(await confirmer({
      titre: 'Approuver les dépenses',
      message: `Approuver ${retenues.length} dépense(s) ? ${formaterFcfa(total)} sortiront des caisses concernées, et les pièces ne pourront plus être corrigées ni refusées.`,
      libelleConfirmer: 'Approuver',
    }))) return;
    try {
      const n = await repository.valider({ filialeId: filialeId!, utilisateurId }, retenues.map((d) => d.id));
      notifier('succes', `${n} dépense(s) approuvée(s), ${formaterFcfa(total)} sortis de caisse.`);
      setSelection(new Set());
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Approbation impossible.');
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
          <h1 className="text-2xl font-bold text-neutral-900">Dépenses</h1>
          <p className="text-sm text-neutral-500 mt-1">{filiale?.nom} · engagement et approbation</p>
          <NoteHistorique quoi="les dépenses" />
        </div>
        <div className="flex gap-2">
          {peutSaisir && (
            <button onClick={() => setSaisie(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg" data-testid="engager-depense">
              <PlusIcon className="w-5 h-5" /> Engager une dépense
            </button>
          )}
          {peutValider && (
            <button onClick={approuverSelection} disabled={retenues.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" data-testid="approuver-depenses">
              <CheckIcon className="w-5 h-5" /> Approuver ({retenues.length})
            </button>
          )}
        </div>
      </div>

      {/*
        Deux chiffres à ne pas confondre, et c'est pourquoi ils sont côte à
        côte : ce qui est **sorti** de la caisse (les dépenses approuvées) et ce
        qui est **engagé sans être payé** — encore en caisse, mais déjà promis.
      */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Indicateur label="Sorti de caisse" valeur={formaterFcfa(stats.sorti)} ton="text-red-700" couleur="orange" icone={WalletIcon} />
        <Indicateur
          label="En attente d'approbation" valeur={`${stats.en_attente}`}
          ton={stats.en_attente ? 'text-orange-700' : undefined}
          couleur="ambre" icone={ClockIcon}
          sous={stats.a_approuver > 0 ? `${formaterFcfa(stats.a_approuver)} engagés, pas encore payés` : undefined}
        />
        <Indicateur label="Dépenses" valeur={`${stats.nombre}`} couleur="violet" icone={ReceiptPercentIcon}
          sous={stats.par_categorie[0] ? `surtout ${stats.par_categorie[0].categorie.toLowerCase().replace(/_/g, ' ')}` : undefined} />
        <Indicateur label="Refusées" valeur={`${stats.refusees}`} couleur="bleu" icone={NoSymbolIcon} />
      </div>

      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} data-testid="depenses-debut" />
        <span className="text-neutral-400">→</span>
        <input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} data-testid="depenses-fin" />
        <button onClick={() => { setDateDebut(aujourdhui()); setDateFin(aujourdhui()); }} className="text-sm text-primary-700 hover:underline">Aujourd'hui</button>
        <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)} className={controleInlineClass}><option value="">Toutes les caisses</option>{caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}</select>
        <select value={statut} onChange={(e) => setStatut(e.target.value as StatutDepense | '')} className={controleInlineClass} data-testid="depenses-statut"><option value="">Tous les statuts</option>{STATUTS_DEPENSE.map((s) => <option key={s} value={s}>{LIBELLES_STATUT_DEPENSE[s]}</option>)}</select>
        <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° de pièce, bénéficiaire…" className={`${controleInlineClass} w-56`} data-testid="depenses-recherche" />
      </div>

      <Carte titre="Dépenses de la période" icone={ReceiptPercentIcon} sousEntier nu
        sous={[`${depenses.length} pièce(s)`, `du ${formaterDate(dateDebut)} au ${formaterDate(dateFin)}`].join(' · ')}
      >
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                {peutValider && <th className="px-3 py-3 print:hidden"><input type="checkbox" checked={toutSelectionne} onChange={(e) => setSelection(e.target.checked ? new Set(enAttenteIds) : new Set())} className="rounded" aria-label="Tout sélectionner" /></th>}
                <th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Pièce</th><th className="px-3 py-3 text-left">Bénéficiaire</th>
                <th className="px-3 py-3 text-left">Catégorie</th><th className="px-3 py-3 text-left">Caisse</th><th className="px-3 py-3 text-left">Engagée par</th>
                <th className="px-3 py-3 text-right">Montant</th><th className="px-3 py-3 text-center">Statut</th><th className="px-3 py-3 print:hidden" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {affichees.map((d) => (
                <tr key={d.id} className={`hover:bg-neutral-50 ${d.statut === 'REFUSEE' ? 'opacity-50' : ''}`} data-testid="ligne-depense">
                  {peutValider && (
                    <td className="px-3 py-2 print:hidden">
                      {d.statut === 'EN_ATTENTE' && (
                        <input
                          type="checkbox" className="rounded" aria-label={`Approuver ${d.numero}`}
                          checked={selection.has(d.id)}
                          onChange={(e) => setSelection((s) => { const n = new Set(s); if (e.target.checked) n.add(d.id); else n.delete(d.id); return n; })}
                        />
                      )}
                    </td>
                  )}
                  <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(d.date_depense)}</td>
                  <td className="px-3 py-2 text-sm font-mono text-primary-700">{d.numero}</td>
                  <td className="px-3 py-2 text-sm">{d.beneficiaire ?? <span className="text-neutral-400">—</span>}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{d.categorie}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{d.caisse_nom}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{d.auteur}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{formaterFcfa(d.montant)}</td>
                  <td className="px-3 py-2 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_DEPENSE_STYLE[d.statut]}`}>{LIBELLES_STATUT_DEPENSE[d.statut]}</span></td>
                  <td className="px-3 py-2 text-center print:hidden"><button onClick={() => setDetail(d)} className="p-1.5 hover:bg-blue-50 rounded text-blue-600" title="Détail"><EyeIcon className="w-4 h-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && depenses.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune dépense sur la période.</div>}
      </Carte>

      <Pagination etat={pages} nom="dépense" data-testid="pagination-depenses" />

      {/* Dire où est l'autre porte : les deux écrans existent, et ils ne font
          pas la même chose. */}
      <p className="text-xs text-neutral-500">
        Une dépense réglée sur-le-champ, sans approbation à demander, se saisit dans <strong>Trésorerie → Dépense</strong> :
        elle débite la caisse aussitôt. Ici, la dépense est engagée puis approuvée, et la caisse ne bouge qu'à l'approbation.
      </p>

      {saisie && <DepenseFormModal filialeId={filialeId} onClose={() => setSaisie(false)} />}
      {detail && (
        <DepenseDetailsModal
          depense={detail}
          filialeId={filialeId}
          peutValider={peutValider}
          peutSaisir={peutSaisir}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}
