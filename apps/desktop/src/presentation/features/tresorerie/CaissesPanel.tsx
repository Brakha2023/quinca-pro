import { useMemo, useState } from 'react';
import { PencilSquareIcon, PlusIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { LIBELLES_CATEGORIE, construireJournalCaisse, type Caisse } from '../../../core/tresorerie';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { controleInlineClass } from '../../components/ui/FormField';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { CaisseFormModal } from './modales';
import { useCaissesToutes, useMouvementsTresorerie, useSoldeOuverture } from './hooks';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const premierDuMois = () => `${new Date().toISOString().slice(0, 7)}-01`;
const formaterDateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/**
 * Liste des caisses et mouvement de caisse : filtre par caisse et par période,
 * solde d'ouverture, solde de clôture, solde actuel, et journal imprimable.
 */
export default function CaissesPanel({ filialeId, filiale }: Props) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const caisses = useCaissesToutes(filialeId);
  const [caisseId, setCaisseId] = useState('');
  const [dateDebut, setDateDebut] = useState(premierDuMois);
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [modal, setModal] = useState<{ type: 'caisse'; caisse?: Caisse } | { type: 'journal' } | null>(null);

  const { mouvements, isLoading } = useMouvementsTresorerie(filialeId, { caisseId: caisseId || null, dateDebut, dateFin, limite: 2000 });
  const { ouverture, soldeActuel } = useSoldeOuverture(filialeId, caisseId || null, dateDebut);

  const journal = useMemo(
    () => construireJournalCaisse(ouverture, mouvements.map((m) => ({
      id: m.id, date_operation: m.date_operation ?? '', type: m.type === 'DEPENSE' ? 'DEPENSE' : 'RECETTE',
      montant: m.montant ?? 0, categorie: m.categorie ?? '', description: m.description, reference: m.reference,
    }))),
    [ouverture, mouvements],
  );
  const caisseChoisie = caisses.find((c) => c.id === caisseId);
  const intitule = caisseChoisie ? caisseChoisie.nom : 'Toutes les caisses';
  const nomCaisse = (id: string | null) => caisses.find((c) => c.id === id)?.nom ?? '';

  const basculer = async (c: Caisse) => {
    if (c.est_active && c.solde_actuel !== 0) { notifier('erreur', 'Videz la caisse (transfert) avant de la désactiver.'); return; }
    const ok = await confirmer({
      titre: c.est_active ? `Désactiver ${c.nom}` : `Réactiver ${c.nom}`,
      message: c.est_active ? 'La caisse ne sera plus proposée pour encaisser. Son historique reste consultable.' : 'La caisse sera de nouveau proposée pour encaisser.',
      libelleConfirmer: c.est_active ? 'Désactiver' : 'Réactiver',
      danger: c.est_active,
    });
    if (!ok) return;
    try { await repository.setActive(c.id, !c.est_active); notifier('succes', `Caisse ${c.nom} ${c.est_active ? 'désactivée' : 'réactivée'}.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">Total en caisses : <strong className="font-mono">{formaterFcfa(caisses.filter((c) => c.est_active).reduce((s, c) => s + c.solde_actuel, 0))}</strong></p>
        <button type="button" onClick={() => setModal({ type: 'caisse' })} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Nouvelle caisse</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
        {caisses.map((c) => (
          <button key={c.id} type="button" data-testid={`caisse-${c.code}`} onClick={() => setCaisseId(caisseId === c.id ? '' : c.id)} className={`text-left bg-white p-5 rounded-xl border-2 shadow-sm transition-colors ${caisseId === c.id ? 'border-primary-500' : 'border-neutral-200 hover:border-primary-300'} ${!c.est_active ? 'opacity-50' : ''}`}>
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

      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-neutral-200 p-4">
        <label className="text-sm">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Caisse</span>
          <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)} className={controleInlineClass} data-testid="filtre-caisse">
            <option value="">Toutes les caisses</option>
            {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Du</span><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} data-testid="filtre-debut" /></label>
        <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Au</span><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} data-testid="filtre-fin" /></label>
        <button type="button" onClick={() => { setDateDebut(aujourdhui()); setDateFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Aujourd'hui</button>
        <button type="button" onClick={() => { setDateDebut(premierDuMois()); setDateFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Ce mois</button>
        <button type="button" onClick={() => setModal({ type: 'journal' })} className="ml-auto flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer le journal</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Carte libelle="Solde d'ouverture" valeur={journal.ouverture} testId="solde-ouverture" />
        <Carte libelle="Recettes" valeur={journal.totalRecettes} couleur="text-green-700" />
        <Carte libelle="Dépenses" valeur={journal.totalDepenses} couleur="text-orange-700" />
        <Carte libelle="Solde de clôture" valeur={journal.cloture} testId="solde-cloture" />
        <Carte libelle="Solde actuel" valeur={soldeActuel} testId="solde-actuel" />
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
            <th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Caisse</th><th className="px-3 py-3 text-left">Catégorie</th><th className="px-3 py-3 text-left">Description</th><th className="px-3 py-3 text-left">Pièce</th><th className="px-3 py-3 text-right">Recette</th><th className="px-3 py-3 text-right">Dépense</th><th className="px-3 py-3 text-right">Solde</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">
            <tr className="bg-neutral-50/60"><td className="px-3 py-2 text-sm text-neutral-600" colSpan={5}>Solde d'ouverture au {new Date(`${dateDebut}T00:00:00`).toLocaleDateString('fr-FR')} — {intitule}</td><td /><td /><td className="px-3 py-2 text-sm text-right font-mono font-semibold">{formaterFcfa(journal.ouverture)}</td></tr>
            {journal.lignes.map((l) => {
              const mouvement = mouvements.find((m) => m.id === l.id);
              return (
                <tr key={l.id} className="hover:bg-neutral-50" data-testid="ligne-journal">
                  <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(l.date)}</td>
                  <td className="px-3 py-2 text-sm">{mouvement?.caisse_nom ?? nomCaisse(mouvement?.caisse_id ?? null)}</td>
                  <td className="px-3 py-2 text-sm"><span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100">{LIBELLES_CATEGORIE[l.categorie] ?? l.categorie}</span></td>
                  <td className="px-3 py-2 text-sm text-neutral-600 max-w-xs truncate" title={l.description}>{l.description || '—'}</td>
                  <td className="px-3 py-2 text-sm font-mono text-neutral-600">{l.piece || '—'}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{l.recette ? formaterFcfa(l.recette) : ''}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-orange-700">{l.depense ? formaterFcfa(l.depense) : ''}</td>
                  <td className={`px-3 py-2 text-sm text-right font-mono ${l.solde < 0 ? 'text-red-600' : 'text-neutral-700'}`}>{formaterFcfa(l.solde)}</td>
                </tr>
              );
            })}
          </tbody>
          {journal.lignes.length > 0 && (
            <tfoot className="bg-neutral-50 border-t-2 border-neutral-300 text-sm font-semibold"><tr>
              <td className="px-3 py-2" colSpan={5}>Totaux de la période</td>
              <td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(journal.totalRecettes)}</td>
              <td className="px-3 py-2 text-right font-mono text-orange-700">{formaterFcfa(journal.totalDepenses)}</td>
              <td className="px-3 py-2 text-right font-mono">{formaterFcfa(journal.cloture)}</td>
            </tr></tfoot>
          )}
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && journal.lignes.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun mouvement sur la période.</div>}
      </div>

      {modal?.type === 'caisse' && <CaisseFormModal filialeId={filialeId} caisse={modal.caisse} onClose={() => setModal(null)} />}
      {modal?.type === 'journal' && (
        <DocumentImprimable titre={`Journal de caisse — ${intitule}`} filiale={filiale} onClose={() => setModal(null)}>
          <div className="document-cartouches">
            <div className="document-bloc"><strong>Période</strong><br />Du {new Date(`${dateDebut}T00:00:00`).toLocaleDateString('fr-FR')} au {new Date(`${dateFin}T00:00:00`).toLocaleDateString('fr-FR')}</div>
            <div className="document-bloc"><strong>Caisse</strong><br />{intitule}{caisseChoisie?.responsable ? <><br />Responsable : {caisseChoisie.responsable}</> : null}</div>
            <div className="document-bloc"><strong>Soldes</strong><br />Ouverture : {formaterFcfa(journal.ouverture)}<br />Clôture : {formaterFcfa(journal.cloture)}</div>
          </div>
          <table>
            <thead><tr><th>Date</th><th>Caisse</th><th>Catégorie</th><th>Description</th><th>Pièce</th><th>Recette</th><th>Dépense</th><th>Solde</th></tr></thead>
            <tbody>
              <tr><td colSpan={7}><em>Solde d'ouverture</em></td><td className="num">{formaterFcfa(journal.ouverture)}</td></tr>
              {journal.lignes.map((l) => {
                const mouvement = mouvements.find((m) => m.id === l.id);
                return (
                  <tr key={l.id}>
                    <td>{formaterDateHeure(l.date)}</td>
                    <td>{mouvement?.caisse_nom ?? nomCaisse(mouvement?.caisse_id ?? null)}</td>
                    <td>{LIBELLES_CATEGORIE[l.categorie] ?? l.categorie}</td>
                    <td>{l.description}</td>
                    <td>{l.piece}</td>
                    <td className="num">{l.recette ? formaterFcfa(l.recette) : ''}</td>
                    <td className="num">{l.depense ? formaterFcfa(l.depense) : ''}</td>
                    <td className="num">{formaterFcfa(l.solde)}</td>
                  </tr>
                );
              })}
              <tr><td colSpan={5}><strong>Totaux</strong></td><td className="num"><strong>{formaterFcfa(journal.totalRecettes)}</strong></td><td className="num"><strong>{formaterFcfa(journal.totalDepenses)}</strong></td><td className="num"><strong>{formaterFcfa(journal.cloture)}</strong></td></tr>
            </tbody>
          </table>
          <div className="recu-signatures"><span>Le caissier</span><span>Le gérant</span></div>
        </DocumentImprimable>
      )}
    </div>
  );
}

function Carte({ libelle, valeur, couleur = 'text-neutral-900', testId }: { libelle: string; valeur: number; couleur?: string; testId?: string }) {
  return (
    <div className="bg-white rounded-xl border border-neutral-200 p-4" data-testid={testId}>
      <p className="text-xs uppercase tracking-wide text-neutral-500">{libelle}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${valeur < 0 ? 'text-red-600' : couleur}`}>{formaterFcfa(valeur)}</p>
    </div>
  );
}
