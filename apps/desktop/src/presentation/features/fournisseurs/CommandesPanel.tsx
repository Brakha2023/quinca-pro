import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DocumentTextIcon, EyeIcon, PlusIcon, PrinterIcon, TrashIcon, TruckIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { StatutCommandeFournisseur } from '@quinca/shared-types';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { Article } from '../../../core/articles';
import { LIBELLES_STATUT_COMMANDE, bonCommandeSchema, documentsCommande, receptionSchema, totalLigneCommande, totauxCommande, type LigneCommandeFournisseur } from '../../../core/fournisseurs';
import { FournisseursRepository } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import FormField, { controleInlineClass, inputClass } from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { remiseSaisie } from '../../../core/commun/prix';
import ArticlePicker from '../stock/ArticlePicker';
import { formaterDateHeure } from '../ventes/VenteDetailsModal';
import BonCommandeDocument from './BonCommandeDocument';
import { FactureAchatImprimable } from './FactureAchatDocument';
import SelectFournisseur from './SelectFournisseur';
import { useCommandes, useFournisseur, useFournisseurs, useLignesCommande, type CommandeVueRow } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

const STATUT_STYLE: Record<StatutCommandeFournisseur, string> = {
  BROUILLON: 'bg-neutral-100 text-neutral-700', ENVOYEE: 'bg-blue-100 text-blue-700', PARTIELLE: 'bg-orange-100 text-orange-700', LIVREE: 'bg-green-100 text-green-700', ANNULEE: 'bg-red-100 text-red-700',
};

interface LigneUI { article: Article; quantite: number; prix_unitaire_ht: number; remise_percent: number }

function NouveauBonModal({ filialeId, fournisseurId, onClose }: { filialeId: string; fournisseurId: string; onClose: () => void }) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { depots } = useDepots(filialeId, { actifs: true });
  const [fid, setFid] = useState(fournisseurId);
  const [depotId, setDepotId] = useState('');
  const [numero, setNumero] = useState('');
  const [dateLivraison, setDateLivraison] = useState('');
  const [remise, setRemise] = useState(0);
  const [tva, setTva] = useState(0);
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<LigneUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const depotEffectif = depotId || depots[0]?.id || '';
  const totaux = totauxCommande({ remise_percent: remise, tva_percent: tva, lignes });

  const exporter = async () => {
    try {
      const chemin = await exporterExcel(numero || 'bon-de-commande', [{
        nom: 'Bon de commande',
        lignes: lignes.map((l) => ({
          Code: l.article.code,
          Désignation: l.article.designation,
          Unité: l.article.unite,
          Quantité: l.quantite,
          'Prix U. HT': l.prix_unitaire_ht,
          'Remise %': l.remise_percent,
          'Total HT': totalLigneCommande(l),
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const valider = async () => {
    const parsed = bonCommandeSchema.safeParse({ fournisseur_id: fid, depot_id: depotEffectif, numero, date_livraison_prevue: dateLivraison, remise_percent: remise, tva_percent: tva, notes, lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite, prix_unitaire_ht: l.prix_unitaire_ht, remise_percent: l.remise_percent })) });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const r = await repository.creerBonCommande({ filialeId, utilisateurId: utilisateur?.id ?? null }, parsed.data);
      notifier('succes', `Bon de commande ${r.numero} créé (${formaterFcfa(totaux.net_a_payer)}).`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal titre="Nouveau bon de commande" sousTitre="Rien n'entre en stock et aucune dette n'est créée avant la réception." largeur="max-w-4xl" onClose={onClose} pied={
      <>
        <span className="mr-auto text-sm text-neutral-600">Net à payer : <strong className="font-mono">{formaterFcfa(totaux.net_a_payer)}</strong></span>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="button" onClick={exporter} disabled={lignes.length === 0} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 disabled:text-neutral-400 text-neutral-700 font-medium rounded-lg" data-testid="exporter-excel">Exporter en Excel</button>
        <button type="button" onClick={valider} disabled={enCours || lignes.length === 0 || !fid} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">Créer le bon</button>
      </>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="md:col-span-2"><SelectFournisseur filialeId={filialeId} value={fid} onChange={setFid} /></div>
          <FormField label="Dépôt de livraison" obligatoire><select value={depotEffectif} onChange={(e) => setDepotId(e.target.value)} className={inputClass}>{depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</select></FormField>
          <FormField label="N° commande"><input value={numero} onChange={(e) => setNumero(e.target.value)} className={`${inputClass} font-mono`} placeholder="Auto si vide" /></FormField>
          <FormField label="Livraison prévue"><input type="date" value={dateLivraison} onChange={(e) => setDateLivraison(e.target.value)} className={inputClass} /></FormField>
          <div className="grid grid-cols-2 gap-2">
            <FormField label="Remise %"><input type="number" min="0" max="100" value={remise} onChange={(e) => setRemise(Number(e.target.value))} className={`${inputClass} text-right font-mono`} /></FormField>
            <FormField label="TVA %"><input type="number" min="0" max="100" value={tva} onChange={(e) => setTva(Number(e.target.value))} className={`${inputClass} text-right font-mono`} /></FormField>
          </div>
        </div>
        <ArticlePicker filialeId={filialeId} onSelect={(a) => { if (!lignes.some((l) => l.article.id === a.id)) setLignes([...lignes, { article: a, quantite: 1, prix_unitaire_ht: a.prix_achat, remise_percent: 0 }]); }} placeholder="Ajouter un article au bon (code ou désignation)…" />
        <div className="border border-neutral-200 rounded-lg overflow-hidden" data-testid="bon-lignes">
          <table className="tableau">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Code / Réf.</th><th className="px-3 py-2 text-left">Désignation</th><th className="px-3 py-2 text-right w-28">Qté</th><th className="px-3 py-2 text-right w-36">Prix U. HT</th><th className="px-3 py-2 text-right w-24">Remise %</th><th className="px-3 py-2 text-right">Total HT</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.map((l, i) => (
                <tr key={l.article.id}>
                  <td className="px-3 py-2 text-sm font-mono text-primary-700">{l.article.code}</td>
                  <td className="px-3 py-2 text-sm">{l.article.designation}<span className="text-neutral-400 text-xs ml-2">{l.article.unite}</span></td>
                  <td className="px-3 py-2"><input type="number" min="0" step="any" value={l.quantite} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, quantite: Number(e.target.value) } : x)))} className={`${inputClass} text-right font-mono`} /></td>
                  <td className="px-3 py-2"><input type="number" min="0" step="1" value={l.prix_unitaire_ht} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, prix_unitaire_ht: Number(e.target.value) } : x)))} className={`${inputClass} text-right font-mono`} /></td>
                  <td className="px-3 py-2"><input type="number" min="0" max="100" step="any" value={l.remise_percent} onFocus={(e) => e.target.select()} onChange={(e) => setLignes(lignes.map((x, j) => (j === i ? { ...x, remise_percent: remiseSaisie(e.target.value) } : x)))} className={`${inputClass} text-right font-mono`} data-testid={`remise-${l.article.code}`} /></td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(totalLigneCommande(l))}</td>
                  <td className="px-3 py-2 text-center"><button type="button" onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Retirer"><TrashIcon className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {lignes.length === 0 && <tr><td colSpan={7} className="px-3 py-5 text-center text-sm text-neutral-400">Aucune ligne.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between gap-4">
          <FormField label="Notes" className="flex-1"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} maxLength={500} /></FormField>
          <dl className="text-sm w-64 space-y-1 self-end">
            <div className="flex justify-between"><dt>Montant brut HT</dt><dd className="font-mono">{formaterFcfa(totaux.brut_ht)}</dd></div>
            {totaux.remise_lignes > 0 && <div className="flex justify-between text-neutral-500"><dt>dont remises de ligne</dt><dd className="font-mono">{formaterFcfa(totaux.remise_lignes)}</dd></div>}
            <div className="flex justify-between"><dt>Remise totale</dt><dd className="font-mono" data-testid="remise-totale">{formaterFcfa(totaux.remise)}</dd></div>
            <div className="flex justify-between"><dt>Montant net HT</dt><dd className="font-mono">{formaterFcfa(totaux.net_ht)}</dd></div>
            <div className="flex justify-between"><dt>Total TVA</dt><dd className="font-mono">{formaterFcfa(totaux.tva)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Net à payer</dt><dd className="font-mono">{formaterFcfa(totaux.net_a_payer)}</dd></div>
          </dl>
        </div>
      </div>
    </Modal>
  );
}

function ReceptionModal({ filialeId, commande, lignes, onClose }: { filialeId: string; commande: CommandeVueRow; lignes: LigneCommandeFournisseur[]; onClose: () => void }) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const { depots } = useDepots(filialeId, { actifs: true });
  const [depotId, setDepotId] = useState(commande.depot_id ?? '');
  const [reference, setReference] = useState('');
  // Par défaut, tout le reliquat est reçu ; seules les lignes ajustées (réception partielle) sont mémorisées.
  const [ajustements, setAjustements] = useState<Record<string, number>>({});
  const [enCours, setEnCours] = useState(false);
  const depotEffectif = depotId || depots[0]?.id || '';
  const restantes = lignes.filter((l) => l.quantite_recue < l.quantite);
  const recue = (l: LigneCommandeFournisseur) => ajustements[l.id] ?? l.quantite - l.quantite_recue;

  const valider = async () => {
    const parsed = receptionSchema.safeParse({ depot_id: depotEffectif, reference, lignes: restantes.map((l) => ({ ligne_id: l.id, quantite_recue: recue(l) })) });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const r = await repository.receptionner({ filialeId, utilisateurId: utilisateur?.id ?? null }, commande.id, parsed.data);
      notifier('succes', `Réception ${commande.numero} : ${formaterFcfa(r.total_ttc)} entrés en stock et portés en dette (${LIBELLES_STATUT_COMMANDE[r.statut as StatutCommandeFournisseur]}).`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Réception impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal titre={`Réceptionner ${commande.numero}`} sousTitre={`${commande.fournisseur_nom} · les quantités reçues entrent en stock au prix de commande`} largeur="max-w-3xl" onClose={onClose} pied={
      <>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <button type="button" onClick={valider} disabled={enCours} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">Valider la réception</button>
      </>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField label="Dépôt de réception" obligatoire><select value={depotEffectif} onChange={(e) => setDepotId(e.target.value)} className={inputClass}>{depots.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}</select></FormField>
          <FormField label="N° BL / facture fournisseur"><input value={reference} onChange={(e) => setReference(e.target.value)} className={`${inputClass} font-mono`} placeholder={commande.numero ?? ''} /></FormField>
        </div>
        <table className="tableau border border-neutral-200 rounded-lg overflow-hidden">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Commandé</th><th className="px-3 py-2 text-right">Déjà reçu</th><th className="px-3 py-2 text-right w-32">Reçu maintenant</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {restantes.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code_article}</span>{l.designation}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{l.quantite}</td>
                <td className="px-3 py-2 text-sm text-right font-mono text-neutral-500">{l.quantite_recue}</td>
                <td className="px-3 py-2"><input type="number" min="0" max={l.quantite - l.quantite_recue} step="any" value={recue(l)} onChange={(e) => setAjustements({ ...ajustements, [l.id]: Number(e.target.value) })} className={`${inputClass} text-right font-mono`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

function DetailCommandeModal({ commande, lignes, onClose, onImprimer, onFacturer }: { commande: CommandeVueRow; lignes: LigneCommandeFournisseur[]; onClose: () => void; onImprimer: () => void; onFacturer: () => void }) {
  const statut = (commande.statut ?? 'ENVOYEE') as StatutCommandeFournisseur;
  const documents = documentsCommande({ type: commande.type === 'BON_COMMANDE' ? 'BON_COMMANDE' : 'COMMANDE', total_recu_ttc: commande.total_recu_ttc ?? 0, statut });
  return (
    <Modal titre={`Commande ${commande.numero}`} sousTitre={`${commande.fournisseur_nom} · ${formaterDateHeure(commande.date_commande)}`} largeur="max-w-3xl" onClose={onClose} pied={
      <>
        {documents.includes('BON') && <button type="button" onClick={onImprimer} className="mr-auto flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-4 h-4" /> Imprimer le bon</button>}
        {documents.includes('FACTURE') && <button type="button" onClick={onFacturer} className={`${documents.includes('BON') ? '' : 'mr-auto '}flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg`} data-testid="facture-depuis-detail"><DocumentTextIcon className="w-4 h-4" /> Facture d'achat</button>}
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Fermer</button>
      </>
    }>
      <div className="space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[statut]}`}>{LIBELLES_STATUT_COMMANDE[statut]}</span>
          <span>Dépôt : <strong>{commande.depot_nom ?? '—'}</strong></span>
          {commande.date_livraison_prevue && <span>Livraison prévue : <strong>{formaterDate(commande.date_livraison_prevue)}</strong></span>}
          {commande.date_reception && <span>Dernière réception : <strong>{formaterDateHeure(commande.date_reception)}</strong></span>}
        </div>
        <table className="tableau border border-neutral-200 rounded-lg overflow-hidden">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Commandé</th><th className="px-3 py-2 text-right">Reçu</th><th className="px-3 py-2 text-right">Prix U. HT</th><th className="px-3 py-2 text-right">Total HT</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((l) => <tr key={l.id}><td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code_article}</span>{l.designation}</td><td className="px-3 py-2 text-sm text-right font-mono">{l.quantite}</td><td className={`px-3 py-2 text-sm text-right font-mono ${l.quantite_recue < l.quantite ? 'text-orange-700' : 'text-green-700'}`}>{l.quantite_recue}</td><td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(l.prix_unitaire_ht)}</td><td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(l.total_ht)}</td></tr>)}
          </tbody>
        </table>
        <div className="grid grid-cols-4 gap-3 text-sm">
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Total commande TTC</p><p className="font-mono font-semibold">{formaterFcfa(commande.total_ttc)}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Reçu (dette générée)</p><p className="font-mono font-semibold">{formaterFcfa(commande.total_recu_ttc)}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Payé</p><p className="font-mono font-semibold text-green-700">{formaterFcfa(commande.montant_paye)}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Reste à payer</p><p className="font-mono font-semibold text-red-600">{formaterFcfa(commande.reste_a_payer)}</p></div>
        </div>
        {commande.notes && <p className="text-sm text-neutral-600">{commande.notes}</p>}
      </div>
    </Modal>
  );
}

type ModalState = { type: 'nouveau' } | { type: 'detail'; c: CommandeVueRow } | { type: 'imprimer'; c: CommandeVueRow } | { type: 'facture'; c: CommandeVueRow } | { type: 'reception'; c: CommandeVueRow } | null;

/** Bons de commande fournisseurs : création, impression, réception (partielle ou totale), annulation. */
export default function CommandesPanel({ filialeId, filiale }: Props) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const [params, setParams] = useSearchParams();
  const fournisseurId = params.get('id') ?? '';
  const [ouvertes, setOuvertes] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const { fournisseurs } = useFournisseurs(filialeId, { inclureInactifs: true });
  const { commandes, isLoading } = useCommandes(filialeId, { fournisseurId: fournisseurId || null, ouvertesSeulement: ouvertes, recherche });
  // Seule la page courante est rendue ; l'impression et l'export, eux,
  // reçoivent toujours `commandes` en entier.
  const pages = usePagination(commandes.length, [fournisseurId, ouvertes, recherche]);
  const affiches = pages.trancher(commandes);
  const commandeActive = modal && modal.type !== 'nouveau' ? modal.c : null;
  const lignes = useLignesCommande(commandeActive?.id ?? null);
  const fournisseurActif = useFournisseur(commandeActive?.fournisseur_id ?? null);
  const totalOuvert = useMemo(() => commandes.filter((c) => c.statut === 'ENVOYEE' || c.statut === 'PARTIELLE').reduce((s, c) => s + ((c.total_ttc ?? 0) - (c.total_recu_ttc ?? 0)), 0), [commandes]);

  const annuler = async (c: CommandeVueRow) => {
    if (!(await confirmer({ message: `Annuler le bon de commande ${c.numero} ?`, libelleConfirmer: 'Annuler le bon', danger: true }))) return;
    try { await repository.annulerCommande(c.id); notifier('succes', `Bon ${c.numero} annulé.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Annulation impossible.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Fournisseur" className="min-w-[16rem]">
          <select value={fournisseurId} onChange={(e) => setParams(e.target.value ? { id: e.target.value } : {})} className={inputClass}><option value="">Tous</option>{fournisseurs.map((f) => <option key={f.id} value={f.id}>{f.raison_sociale}</option>)}</select>
        </FormField>
        <FormField label="Recherche"><input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° ou fournisseur…" className={inputClass} /></FormField>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={ouvertes} onChange={(e) => setOuvertes(e.target.checked)} className="rounded" /> En attente de livraison</label>
        <span className="text-sm text-neutral-600 ml-auto">Reste à livrer : <strong className="font-mono">{formaterFcfa(totalOuvert)}</strong></span>
        <button type="button" onClick={() => setModal({ type: 'nouveau' })} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Nouvelle commande</button>
      </div>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-x-auto">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">N°</th><th className="px-3 py-2 text-left">Fournisseur</th><th className="px-3 py-2 text-left">Type</th><th className="px-3 py-2 text-right">Lignes</th><th className="px-3 py-2 text-right">Total TTC</th><th className="px-3 py-2 text-right">Reçu</th><th className="px-3 py-2 text-right">Reste à payer</th><th className="px-3 py-2 text-left">Statut</th><th className="px-3 py-2 text-center">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {affiches.map((c) => {
              const statut = (c.statut ?? 'ENVOYEE') as StatutCommandeFournisseur;
              const ouverte = statut === 'ENVOYEE' || statut === 'PARTIELLE';
              // Un bon s'imprime dès sa création ; la facture attend la marchandise.
              const documents = documentsCommande({ type: c.type === 'BON_COMMANDE' ? 'BON_COMMANDE' : 'COMMANDE', total_recu_ttc: c.total_recu_ttc ?? 0, statut });
              return (
                <tr key={c.id} className="hover:bg-neutral-50">
                  <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(c.date_commande)}</td>
                  <td className="px-3 py-2 text-sm font-mono">{c.numero}</td>
                  <td className="px-3 py-2 text-sm font-medium">{c.fournisseur_nom}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{c.type === 'BON_COMMANDE' ? 'Bon de commande' : 'Achat direct'}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{c.nombre_lignes}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(c.total_ttc)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(c.total_recu_ttc)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-red-600">{formaterFcfa(c.reste_a_payer)}</td>
                  <td className="px-3 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[statut]}`}>{LIBELLES_STATUT_COMMANDE[statut]}</span></td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setModal({ type: 'detail', c })} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Détail"><EyeIcon className="w-4 h-4" /></button>
                      {documents.includes('BON') && <button onClick={() => setModal({ type: 'imprimer', c })} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700" title="Imprimer le bon de commande"><PrinterIcon className="w-4 h-4" /></button>}
                      {documents.includes('FACTURE') && <button onClick={() => setModal({ type: 'facture', c })} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700" title="Imprimer la facture d'achat" data-testid={`facture-${c.numero}`}><DocumentTextIcon className="w-4 h-4" /></button>}
                      {ouverte && <button onClick={() => setModal({ type: 'reception', c })} className="p-1.5 rounded hover:bg-primary-50 text-primary-700" title="Réceptionner"><TruckIcon className="w-4 h-4" /></button>}
                      {statut === 'ENVOYEE' && <button onClick={() => annuler(c)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Annuler le bon"><XCircleIcon className="w-4 h-4" /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && commandes.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune commande.</div>}
      </div>

      <Pagination etat={pages} nom="commande" data-testid="pagination-commandes" />

      {modal?.type === 'nouveau' && <NouveauBonModal filialeId={filialeId} fournisseurId={fournisseurId} onClose={() => setModal(null)} />}
      {modal?.type === 'detail' && <DetailCommandeModal commande={modal.c} lignes={lignes} onClose={() => setModal(null)} onImprimer={() => setModal({ type: 'imprimer', c: modal.c })} onFacturer={() => setModal({ type: 'facture', c: modal.c })} />}
      {modal?.type === 'imprimer' && <BonCommandeDocument commande={modal.c} lignes={lignes} fournisseur={fournisseurActif} filiale={filiale} onClose={() => setModal(null)} />}
      {modal?.type === 'facture' && <FactureAchatImprimable commandeId={modal.c.id} filiale={filiale} onClose={() => setModal(null)} />}
      {modal?.type === 'reception' && <ReceptionModal filialeId={filialeId} commande={modal.c} lignes={lignes} onClose={() => setModal(null)} />}
    </div>
  );
}
