import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon, MagnifyingGlassIcon, PencilSquareIcon, PlusIcon, PrinterIcon } from '@heroicons/react/24/outline';
import {
  ETATS_CAISSE, construireJournalCaisse, filtrerCaisses, perimetreCaisses, recapEtatCaisses,
  type Caisse, type EtatCaisseRetenu, type LigneEtatCaisse,
} from '../../../core/tresorerie';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import NoteHistorique from '../../components/ui/NoteHistorique';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import EtatCaissesDocument from './EtatCaissesDocument';
import { CaisseFormModal } from './modales';
import { useCategoriesTresorerie, useEtatCaisses, useMouvementsTresorerie, useSoldeOuverture } from './hooks';

const aujourdhui = () => new Date().toISOString().slice(0, 10);
const premierDuMois = () => `${new Date().toISOString().slice(0, 7)}-01`;
const formaterDateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');
const enJour = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString('fr-FR');
/** Montant en colonne : le rouge signale une caisse à découvert, jamais normal. */
const montant = (valeur: number) => `px-3 py-2 text-sm text-right font-mono whitespace-nowrap ${valeur < 0 ? 'text-red-600 font-semibold' : 'text-neutral-700'}`;

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/**
 * Liste des caisses et journal de caisse.
 *
 * Une maison qui tient quinze caisses ne les lit pas en cartes : la liste est
 * un tableau dense — ouverture, entrées, sorties, clôture, solde du jour — avec
 * le total en bas, filtrable, imprimable en A4 et exportable en Excel. Cliquer
 * une ligne ouvre le journal de cette caisse en dessous.
 */
export default function CaissesPanel({ filialeId, filiale }: Props) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();

  const [dateDebut, setDateDebut] = useState(premierDuMois);
  const [dateFin, setDateFin] = useState(aujourdhui);
  const [recherche, setRecherche] = useState('');
  const [etat, setEtat] = useState<EtatCaisseRetenu>('ACTIVES');
  const [caisseId, setCaisseId] = useState('');
  const [modal, setModal] = useState<{ type: 'caisse'; caisse?: Caisse } | { type: 'journal' } | { type: 'etat' } | null>(null);

  // Le journal doit nommer une catégorie ajoutée par la maison, pas afficher
  // son code nu : les libellés viennent donc de la filiale, pas du seul code.
  const { libelles } = useCategoriesTresorerie(filialeId);
  const { caisses, lignes: toutes } = useEtatCaisses(filialeId, dateDebut, dateFin);
  const lignes = useMemo(() => filtrerCaisses(toutes, { recherche, etat }), [toutes, recherche, etat]);
  // Le récapitulatif porte sur les lignes **retenues** : c'est ce total qui
  // s'imprime, et il doit être celui qu'on lit à l'écran.
  const recap = recapEtatCaisses(lignes);
  const filtresEtat = { recherche, etat, debut: enJour(dateDebut), fin: enJour(dateFin) };

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

  const basculer = async (ligne: LigneEtatCaisse) => {
    const c = caisses.find((x) => x.id === ligne.id);
    if (!c) return;
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

  const exporterEtat = async () => {
    try {
      const chemin = await exporterExcel('etat-des-caisses', [{
        nom: 'Caisses',
        lignes: lignes.map((l) => ({
          Code: l.code,
          Libellé: l.nom,
          Responsable: l.responsable ?? '',
          État: l.est_active ? 'Active' : 'Fermée',
          "Solde d'ouverture": l.ouverture,
          'Total entrées': l.recettes,
          'Total sorties': l.depenses,
          'Solde de clôture': l.cloture,
          'Solde actuel': l.solde_actuel,
          Mouvements: l.mouvements,
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const exporterJournal = async () => {
    try {
      const chemin = await exporterExcel(`journal-de-caisse${caisseChoisie ? `-${caisseChoisie.code}` : ''}`, [{
        nom: 'Journal',
        lignes: journal.lignes.map((l) => {
          const m = mouvements.find((x) => x.id === l.id);
          return {
            Date: formaterDateHeure(l.date),
            Caisse: m?.caisse_nom ?? nomCaisse(m?.caisse_id ?? null),
            Catégorie: libelles[l.categorie] ?? l.categorie,
            Description: l.description,
            Pièce: l.piece,
            Recette: l.recette,
            Dépense: l.depense,
            Solde: l.solde,
          };
        }),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          Total en caisses aujourd'hui : <strong className="font-mono">{formaterFcfa(recap.solde_actuel)}</strong>
          {recap.negatives > 0 && <span className="ml-2 text-red-600">· {recap.negatives} à découvert</span>}
        </p>
        <button type="button" onClick={() => setModal({ type: 'caisse' })} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Nouvelle caisse</button>
      </div>
      <NoteHistorique quoi="le journal de caisse" />

      <div className="flex flex-wrap items-end gap-3 bg-white rounded-xl border border-neutral-200 p-4 print:hidden">
        <label className="text-sm flex-1 min-w-[14rem] max-w-xs">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Rechercher</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Code, libellé, responsable…" className={`${inputClass} pl-10`} data-testid="recherche-caisse" />
          </span>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Caisses retenues</span>
          <select value={etat} onChange={(e) => setEtat(e.target.value as EtatCaisseRetenu)} className={controleInlineClass} data-testid="filtre-etat-caisse">
            {ETATS_CAISSE.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
        <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Du</span><input type="date" value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} className={controleInlineClass} data-testid="filtre-debut" /></label>
        <label className="text-sm"><span className="block text-xs font-medium text-neutral-700 mb-1">Au</span><input type="date" value={dateFin} onChange={(e) => setDateFin(e.target.value)} className={controleInlineClass} data-testid="filtre-fin" /></label>
        <button type="button" onClick={() => { setDateDebut(aujourdhui()); setDateFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Aujourd'hui</button>
        <button type="button" onClick={() => { setDateDebut(premierDuMois()); setDateFin(aujourdhui()); }} className="px-3 py-2 text-sm text-primary-700 hover:bg-primary-50 rounded-lg">Ce mois</button>
        <div className="ml-auto flex items-end gap-2">
          <span className="text-sm text-neutral-600 pb-2" data-testid="compteur-caisses">
            <strong>{recap.nombre}</strong> caisse(s) · clôture <strong className="font-mono">{formaterFcfa(recap.cloture)}</strong>
          </span>
          <button type="button" onClick={() => setModal({ type: 'etat' })} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="imprimer-caisses"><PrinterIcon className="w-4 h-4" /> Imprimer / PDF</button>
          <button type="button" onClick={exporterEtat} className="flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="exporter-caisses"><ArrowDownTrayIcon className="w-4 h-4" /> Exporter Excel</button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <p className="px-4 py-3 text-sm font-semibold text-neutral-700 border-b border-neutral-200 bg-neutral-50">
          Liste des caisses <span className="font-normal text-neutral-500">· {perimetreCaisses(filtresEtat)}</span>
        </p>
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-left">Responsable</th>
                <th className="px-3 py-2 text-right">Solde d'ouverture</th>
                <th className="px-3 py-2 text-right">Entrées</th>
                <th className="px-3 py-2 text-right">Sorties</th>
                <th className="px-3 py-2 text-right">Solde de clôture</th>
                <th className="px-3 py-2 text-right">Solde actuel</th>
                <th className="px-3 py-2 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.map((l) => (
                <tr
                  key={l.id}
                  data-testid={`caisse-${l.code}`}
                  onClick={() => setCaisseId(caisseId === l.id ? '' : l.id)}
                  className={`cursor-pointer hover:bg-neutral-50 ${caisseId === l.id ? 'bg-primary-50' : ''} ${l.est_active ? '' : 'opacity-60'}`}
                >
                  <td className="px-3 py-2 text-sm font-mono text-neutral-600">{l.code}</td>
                  <td className="px-3 py-2 text-sm font-medium text-neutral-900">{l.nom}{!l.est_active && <span className="ml-2 text-xs text-neutral-500">(fermée)</span>}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{l.responsable || '—'}</td>
                  <td className={montant(l.ouverture)}>{formaterFcfa(l.ouverture)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono whitespace-nowrap text-green-700">{l.recettes ? formaterFcfa(l.recettes) : '—'}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono whitespace-nowrap text-orange-700">{l.depenses ? formaterFcfa(l.depenses) : '—'}</td>
                  <td className={montant(l.cloture)}>{formaterFcfa(l.cloture)}</td>
                  <td className={`${montant(l.solde_actuel)} font-semibold`}>{formaterFcfa(l.solde_actuel)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setModal({ type: 'caisse', caisse: caisses.find((c) => c.id === l.id) }); }} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500" title="Modifier"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); basculer(l); }} className="px-2 py-1 rounded text-xs text-neutral-500 hover:bg-neutral-100">{l.est_active ? 'Désactiver' : 'Réactiver'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {lignes.length > 0 && (
              <tfoot className="bg-amber-50 border-t-2 border-neutral-300 text-sm font-semibold">
                <tr>
                  <td className="px-3 py-2" colSpan={3}>Total — {recap.nombre} caisse(s)</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{formaterFcfa(recap.ouverture)}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-green-700">{formaterFcfa(recap.recettes)}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap text-orange-700">{formaterFcfa(recap.depenses)}</td>
                  <td className="px-3 py-2 text-right font-mono whitespace-nowrap">{formaterFcfa(recap.cloture)}</td>
                  <td className={`px-3 py-2 text-right font-mono whitespace-nowrap ${recap.solde_actuel < 0 ? 'text-red-600' : ''}`} data-testid="total-caisses">{formaterFcfa(recap.solde_actuel)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {lignes.length === 0 && <div className="text-center py-10 text-neutral-400 text-sm">Aucune caisse dans ce périmètre.</div>}
      </div>

      <div className="flex flex-wrap items-end gap-3 print:hidden">
        <label className="text-sm">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Journal de la caisse</span>
          <select value={caisseId} onChange={(e) => setCaisseId(e.target.value)} className={controleInlineClass} data-testid="filtre-caisse">
            <option value="">Toutes les caisses</option>
            {caisses.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
          </select>
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={() => setModal({ type: 'journal' })} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer le journal</button>
          <button type="button" onClick={exporterJournal} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg" data-testid="exporter-journal"><ArrowDownTrayIcon className="w-5 h-5" /> Exporter Excel</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Carte libelle="Solde d'ouverture" valeur={journal.ouverture} testId="solde-ouverture" />
        <Carte libelle="Recettes" valeur={journal.totalRecettes} couleur="text-green-700" />
        <Carte libelle="Dépenses" valeur={journal.totalDepenses} couleur="text-orange-700" />
        <Carte libelle="Solde de clôture" valeur={journal.cloture} testId="solde-cloture" />
        <Carte libelle="Solde actuel" valeur={soldeActuel} testId="solde-actuel" />
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
            <th className="px-3 py-3 text-left">Date</th><th className="px-3 py-3 text-left">Caisse</th><th className="px-3 py-3 text-left">Catégorie</th><th className="px-3 py-3 text-left">Description</th><th className="px-3 py-3 text-left">Pièce</th><th className="px-3 py-3 text-right">Recette</th><th className="px-3 py-3 text-right">Dépense</th><th className="px-3 py-3 text-right">Solde</th>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">
            <tr className="bg-neutral-50/60"><td className="px-3 py-2 text-sm text-neutral-600" colSpan={5}>Solde d'ouverture au {enJour(dateDebut)} — {intitule}</td><td /><td /><td className="px-3 py-2 text-sm text-right font-mono font-semibold">{formaterFcfa(journal.ouverture)}</td></tr>
            {journal.lignes.map((l) => {
              const mouvement = mouvements.find((m) => m.id === l.id);
              return (
                <tr key={l.id} className="hover:bg-neutral-50" data-testid="ligne-journal">
                  <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(l.date)}</td>
                  <td className="px-3 py-2 text-sm">{mouvement?.caisse_nom ?? nomCaisse(mouvement?.caisse_id ?? null)}</td>
                  <td className="px-3 py-2 text-sm"><span className="px-2 py-0.5 rounded-full text-xs bg-neutral-100">{libelles[l.categorie] ?? l.categorie}</span></td>
                  <td className="px-3 py-2 text-sm text-neutral-600 max-w-xs truncate" title={l.description}>{l.description || '—'}</td>
                  <td className="px-3 py-2 text-sm font-mono text-neutral-600">{l.piece || '—'}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{l.recette ? formaterFcfa(l.recette) : ''}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-orange-700">{l.depense ? formaterFcfa(l.depense) : ''}</td>
                  <td className={montant(l.solde)}>{formaterFcfa(l.solde)}</td>
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
      {modal?.type === 'etat' && <EtatCaissesDocument lignes={lignes} filiale={filiale} filtres={filtresEtat} onClose={() => setModal(null)} />}
      {modal?.type === 'journal' && (
        <DocumentImprimable titre={`Journal de caisse — ${intitule}`} filiale={filiale} onClose={() => setModal(null)}>
          <div className="document-cartouches">
            <div className="document-bloc"><strong>Période</strong><br />Du {enJour(dateDebut)} au {enJour(dateFin)}</div>
            <div className="document-bloc"><strong>Caisse</strong><br />{intitule}{caisseChoisie?.responsable ? <><br />Responsable : {caisseChoisie.responsable}</> : null}</div>
            <div className="document-bloc"><strong>Soldes</strong><br />Ouverture : {formaterFcfa(journal.ouverture)}<br />Clôture : {formaterFcfa(journal.cloture)}</div>
          </div>
          <table className="document-liste">
            <thead><tr><th>Date</th><th>Caisse</th><th>Catégorie</th><th>Description</th><th>Pièce</th><th className="num">Recette</th><th className="num">Dépense</th><th className="num">Solde</th></tr></thead>
            <tbody>
              <tr><td colSpan={7}><em>Solde d'ouverture</em></td><td className="num">{formaterFcfa(journal.ouverture)}</td></tr>
              {journal.lignes.map((l) => {
                const mouvement = mouvements.find((m) => m.id === l.id);
                return (
                  <tr key={l.id}>
                    <td>{formaterDateHeure(l.date)}</td>
                    <td>{mouvement?.caisse_nom ?? nomCaisse(mouvement?.caisse_id ?? null)}</td>
                    <td>{libelles[l.categorie] ?? l.categorie}</td>
                    <td>{l.description}</td>
                    <td className="document-code">{l.piece}</td>
                    <td className="num">{l.recette ? formaterFcfa(l.recette) : ''}</td>
                    <td className="num">{l.depense ? formaterFcfa(l.depense) : ''}</td>
                    <td className="num">{formaterFcfa(l.solde)}</td>
                  </tr>
                );
              })}
              <tr><td colSpan={5}><strong>Totaux</strong></td><td className="num"><strong>{formaterFcfa(journal.totalRecettes)}</strong></td><td className="num"><strong>{formaterFcfa(journal.totalDepenses)}</strong></td><td className="num"><strong>{formaterFcfa(journal.cloture)}</strong></td></tr>
            </tbody>
            <tfoot>
              <tr><td colSpan={8} className="document-liste-pied">Journal de caisse · {intitule} · du {enJour(dateDebut)} au {enJour(dateFin)} · {filiale.nom}</td></tr>
            </tfoot>
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
