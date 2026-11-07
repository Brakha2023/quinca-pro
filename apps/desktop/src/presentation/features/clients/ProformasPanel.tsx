import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRightCircleIcon, DocumentDuplicateIcon, EyeIcon, PlusIcon, PrinterIcon, TrashIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { StatutProforma } from '@quinca/shared-types';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import Pagination from '../../components/ui/Pagination';
import { usePagination } from '../../hooks/usePagination';
import type { Article } from '../../../core/articles';
import { LIBELLES_STATUT_PROFORMA, calculerLigne, ligneProformaVersPanier, proformaSchema, remiseCommerciale, totauxProforma, type LignePanier, type Proforma } from '../../../core/ventes';
import { ProformasRepository } from '../../../infrastructure/powersync/repositories/ProformasRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import FormField, { controleInlineClass, inputClass } from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { usePOSStore } from '../../stores/pos.store';
import ArticlePicker from '../stock/ArticlePicker';
import { formaterDateHeure } from '../ventes/VenteDetailsModal';
import SelectClient from './SelectClient';
import { useClient, useClients, useLignesProforma, useProformas } from './hooks';

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

type ProformaVue = Proforma & { client_libelle: string | null; vente_numero: string | null; utilisateur: string; nombre_lignes: number };

const STATUT_STYLE: Record<StatutProforma, string> = { EN_COURS: 'bg-blue-100 text-blue-700', FACTUREE: 'bg-green-100 text-green-700', ANNULEE: 'bg-red-100 text-red-700' };

function NouvelleProformaModal({ filialeId, clientId, onClose }: { filialeId: string; clientId: string; onClose: () => void }) {
  const repository = useRepository(ProformasRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const [cid, setCid] = useState(clientId);
  const client = useClient(cid || null);
  const [clientNom, setClientNom] = useState('');
  const [numero, setNumero] = useState('');
  const [validite, setValidite] = useState('');
  const [remise, setRemise] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [enCours, setEnCours] = useState(false);
  const remiseEffective = remise ?? client?.remise_percent ?? 0;
  const totaux = totauxProforma({ lignes, remise_percent: remiseEffective });

  const ajouter = (a: Article) => {
    if (lignes.some((l) => l.article_id === a.id)) return;
    setLignes([...lignes, { article_id: a.id, code: a.code, designation: a.designation, unite: a.unite, prix_unitaire_ttc: a.prix_vente, tva_percent: a.tva, quantite: 1, remise_percent: 0 }]);
  };
  const modifier = (i: number, patch: Partial<LignePanier>) => setLignes(lignes.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const valider = async () => {
    const parsed = proformaSchema.safeParse({ client_id: cid, client_nom: cid ? '' : clientNom, numero, date_validite: validite, remise_percent: remiseEffective, notes, lignes });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }
    setEnCours(true);
    try {
      const r = await repository.enregistrer({ filialeId, utilisateurId: utilisateur?.id ?? null }, parsed.data);
      notifier('succes', `Proforma ${r.numero} créée (${formaterFcfa(totaux.total_ttc)}).`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal titre="Nouvelle proforma" sousTitre="Devis sans effet sur le stock ni la caisse ; il sera facturé au point de vente." largeur="max-w-4xl" onClose={onClose} pied={
      <>
        <span className="mr-auto text-sm text-neutral-600">Total TTC : <strong className="font-mono">{formaterFcfa(totaux.total_ttc)}</strong></span>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
        <Bouton type="button" onClick={valider} enCours={enCours} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" disabled={enCours || lignes.length === 0}>Créer la proforma</Bouton>
      </>
    }>
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
          <div className="md:col-span-2"><SelectClient filialeId={filialeId} value={cid} onChange={setCid} obligatoire={false} vide="— Client de passage —" /></div>
          {!cid && <FormField label="Nom du client" obligatoire className="md:col-span-2"><input value={clientNom} onChange={(e) => setClientNom(e.target.value)} className={inputClass} placeholder="Client sans compte" /></FormField>}
          <FormField label="N° proforma"><input value={numero} onChange={(e) => setNumero(e.target.value)} className={`${inputClass} font-mono`} placeholder="Auto si vide" /></FormField>
          <FormField label="Valable jusqu'au"><input type="date" value={validite} onChange={(e) => setValidite(e.target.value)} className={inputClass} /></FormField>
          <FormField label="Remise globale %"><input type="number" min="0" max="100" value={remiseEffective} onChange={(e) => setRemise(Number(e.target.value))} className={`${inputClass} text-right font-mono`} /></FormField>
        </div>
        <ArticlePicker filialeId={filialeId} onSelect={ajouter} placeholder="Ajouter un article à la proforma (code ou désignation)…" />
        <div className="border border-neutral-200 rounded-lg overflow-hidden" data-testid="proforma-lignes">
          <table className="tableau">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right w-28">Qté</th><th className="px-3 py-2 text-right w-36">P.U. TTC</th><th className="px-3 py-2 text-right w-24">Remise %</th><th className="px-3 py-2 text-right">Total TTC</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.map((l, i) => (
                <tr key={l.article_id}>
                  <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}<span className="text-neutral-400 text-xs ml-2">{l.unite}</span></td>
                  <td className="px-3 py-2"><input type="number" min="0" step="any" value={l.quantite} onChange={(e) => modifier(i, { quantite: Number(e.target.value) })} className={`${inputClass} text-right font-mono`} /></td>
                  <td className="px-3 py-2"><input type="number" min="0" step="1" value={l.prix_unitaire_ttc} onChange={(e) => modifier(i, { prix_unitaire_ttc: Number(e.target.value) })} className={`${inputClass} text-right font-mono`} /></td>
                  <td className="px-3 py-2"><input type="number" min="0" max="100" value={l.remise_percent} onChange={(e) => modifier(i, { remise_percent: Number(e.target.value) })} className={`${inputClass} text-right font-mono`} /></td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(calculerLigne(l).total_ttc)}</td>
                  <td className="px-3 py-2 text-center"><button type="button" onClick={() => setLignes(lignes.filter((_, j) => j !== i))} className="p-1 text-red-500 hover:bg-red-50 rounded" title="Retirer"><TrashIcon className="w-4 h-4" /></button></td>
                </tr>
              ))}
              {lignes.length === 0 && <tr><td colSpan={6} className="px-3 py-5 text-center text-sm text-neutral-400">Aucune ligne.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex justify-between gap-4">
          <FormField label="Notes" className="flex-1"><input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} maxLength={500} /></FormField>
          <dl className="text-sm w-64 space-y-1 self-end">
            <div className="flex justify-between"><dt>Total HT</dt><dd className="font-mono">{formaterFcfa(totaux.total_net_ht)}</dd></div>
            <div className="flex justify-between"><dt>Remise</dt><dd className="font-mono">{formaterFcfa(totaux.total_remise)}</dd></div>
            <div className="flex justify-between"><dt>TVA</dt><dd className="font-mono">{formaterFcfa(totaux.total_tva)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total TTC</dt><dd className="font-mono">{formaterFcfa(totaux.total_ttc)}</dd></div>
          </dl>
        </div>
      </div>
    </Modal>
  );
}

function ProformaImprimable({ proforma, filiale, onClose }: { proforma: ProformaVue; filiale: Props['filiale']; onClose: () => void }) {
  const lignes = useLignesProforma(proforma.id).map(ligneProformaVersPanier);
  const client = useClient(proforma.client_id);
  const totaux = totauxProforma({ lignes, remise_percent: proforma.remise_percent });
  return (
    <DocumentImprimable titre="Facture proforma" filiale={filiale} onClose={onClose}>
      <div className="document-cartouches">
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th>Proforma n°</th><th>Date</th><th>Validité</th></tr></thead>
          <tbody><tr><td className="num">{proforma.numero}</td><td>{formaterDate(proforma.date_proforma)}</td><td>{proforma.date_validite ? formaterDate(proforma.date_validite) : '—'}</td></tr><tr><td colSpan={3}>Établie par {proforma.utilisateur}</td></tr></tbody>
        </table>
        <table style={{ width: '45%', margin: 0 }}>
          <thead><tr><th colSpan={2}>Client</th></tr></thead>
          <tbody>
            <tr><td colSpan={2}><strong>{proforma.client_libelle}</strong></td></tr>
            {client && <tr><td>Adresse</td><td>{[client.adresse, client.ville].filter(Boolean).join(', ')}</td></tr>}
            {client && <tr><td>Contact</td><td>{[client.contact, client.mobile ?? client.telephone].filter(Boolean).join(' · ')}</td></tr>}
            {client?.numero_cc && <tr><td>N° CC</td><td>{client.numero_cc}</td></tr>}
          </tbody>
        </table>
      </div>
      <table>
        <thead><tr><th>Code</th><th>Désignation</th><th>Qté</th><th>P.U. TTC</th><th>Remise</th><th>Total TTC</th></tr></thead>
        <tbody>{lignes.map((l) => <tr key={l.article_id}><td>{l.code}</td><td>{l.designation}</td><td className="num">{l.quantite} {l.unite}</td><td className="num">{formaterFcfa(l.prix_unitaire_ttc)}</td><td className="num">{l.remise_percent ? `${l.remise_percent} %` : ''}</td><td className="num">{formaterFcfa(calculerLigne(l).total_ttc)}</td></tr>)}</tbody>
      </table>
      <div className="document-cartouches">
        <table style={{ width: '70mm', margin: 0 }}><thead><tr><th>Cachet / Signature</th></tr></thead><tbody><tr><td className="document-signature" /></tr></tbody></table>
        <table className="document-totaux" style={{ margin: 0 }}>
          <tbody>
            <tr><td>Total HT</td><td className="num">{formaterFcfa(totaux.total_net_ht)}</td></tr>
            <tr><td>Remise{proforma.remise_percent ? ` (${proforma.remise_percent} %)` : ''}</td><td className="num">{formaterFcfa(totaux.total_remise)}</td></tr>
            <tr><td>TVA</td><td className="num">{formaterFcfa(totaux.total_tva)}</td></tr>
            <tr><td><strong>Net à payer</strong></td><td className="num">{formaterFcfa(totaux.total_ttc)}</td></tr>
          </tbody>
        </table>
      </div>
      {proforma.notes && <p><em>{proforma.notes}</em></p>}
      <p style={{ fontSize: 10 }}>Document sans valeur de facture : ni stock ni encaissement tant qu'il n'est pas transformé en vente. Montants en FCFA.</p>
    </DocumentImprimable>
  );
}

function DetailProformaModal({ proforma, onClose, onImprimer }: { proforma: ProformaVue; onClose: () => void; onImprimer: () => void }) {
  const lignes = useLignesProforma(proforma.id).map(ligneProformaVersPanier);
  return (
    <Modal titre={`Proforma ${proforma.numero}`} sousTitre={`${proforma.client_libelle} · ${formaterDateHeure(proforma.date_proforma)}`} largeur="max-w-3xl" onClose={onClose} pied={
      <>
        <Bouton onClick={onImprimer} icone={PrinterIcon} className="mr-auto flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Imprimer</Bouton>
        <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Fermer</button>
      </>
    }>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[proforma.statut]}`}>{LIBELLES_STATUT_PROFORMA[proforma.statut]}</span>{proforma.vente_numero && <span>Facturée par la vente <strong className="font-mono">{proforma.vente_numero}</strong></span>}{proforma.date_validite && <span>Valable jusqu'au {formaterDate(proforma.date_validite)}</span>}</div>
        <table className="tableau border border-neutral-200 rounded-lg overflow-hidden">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Qté</th><th className="px-3 py-2 text-right">P.U. TTC</th><th className="px-3 py-2 text-right">Remise</th><th className="px-3 py-2 text-right">Total TTC</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">{lignes.map((l) => <tr key={l.article_id}><td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}</td><td className="px-3 py-2 text-sm text-right font-mono">{l.quantite}</td><td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(l.prix_unitaire_ttc)}</td><td className="px-3 py-2 text-sm text-right font-mono">{l.remise_percent ? `${l.remise_percent} %` : '—'}</td><td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(calculerLigne(l).total_ttc)}</td></tr>)}</tbody>
        </table>
        <p className="text-right text-sm">Total TTC : <strong className="font-mono">{formaterFcfa(proforma.total_ttc)}</strong>{proforma.remise_percent ? ` (remise globale ${proforma.remise_percent} %)` : ''}</p>
        {proforma.notes && <p className="text-sm text-neutral-600">{proforma.notes}</p>}
      </div>
    </Modal>
  );
}

/** Bouton « Facturer » : charge la proforma dans le point de vente, qui la clôture à l'encaissement. */
function BoutonFacturer({ proforma }: { proforma: ProformaVue }) {
  const navigate = useNavigate();
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const chargerProforma = usePOSStore((s) => s.chargerProforma);
  const lignesTicket = usePOSStore((s) => s.lignes);
  const lignes = useLignesProforma(proforma.id);
  const client = useClient(proforma.client_id);
  const facturer = async () => {
    if (lignesTicket.length > 0 && !(await confirmer({ message: 'Le ticket en cours au point de vente sera remplacé par les lignes de la proforma.', libelleConfirmer: 'Remplacer le ticket' }))) return;
    if (proforma.client_id && !client) { notifier('erreur', 'Client introuvable.'); return; }
    // Le comptoir ne connaît que des francs : le taux du devis s'y convertit.
    const lignesDuDevis = lignes.map(ligneProformaVersPanier);
    chargerProforma({ id: proforma.id, numero: proforma.numero }, lignesDuDevis, client, remiseCommerciale(lignesDuDevis, proforma.remise_percent));
    navigate('/pos');
  };
  return <button onClick={facturer} className="p-1.5 rounded hover:bg-green-50 text-green-700" title="Facturer au point de vente"><ArrowRightCircleIcon className="w-4 h-4" /></button>;
}

type ModalState = { type: 'nouvelle' } | { type: 'detail'; p: ProformaVue } | { type: 'imprimer'; p: ProformaVue } | null;

/** Proformas : devis clients convertibles en facture au point de vente. */
export default function ProformasPanel({ filialeId, filiale }: Props) {
  const repository = useRepository(ProformasRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const [params, setParams] = useSearchParams();
  const clientId = params.get('id') ?? '';
  const [enCours, setEnCours] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [modal, setModal] = useState<ModalState>(null);
  const { clients } = useClients(filialeId, { inclureInactifs: true });
  const { proformas, isLoading } = useProformas(filialeId, { clientId: clientId || null, enCoursSeulement: enCours, recherche });
  // Seule la page courante est rendue ; l'impression et l'export, eux,
  // reçoivent toujours `proformas` en entier.
  const pages = usePagination(proformas.length, [clientId, enCours, recherche]);
  const affiches = pages.trancher(proformas);

  const annuler = async (p: ProformaVue) => {
    if (!(await confirmer({ message: `Annuler la proforma ${p.numero} ?`, libelleConfirmer: 'Annuler la proforma', danger: true }))) return;
    try { await repository.annuler(p.id); notifier('succes', `Proforma ${p.numero} annulée.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Annulation impossible.'); }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <FormField label="Client" className="min-w-[16rem]">
          <select value={clientId} onChange={(e) => setParams(e.target.value ? { id: e.target.value } : {})} className={inputClass}><option value="">Tous</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}</select>
        </FormField>
        <FormField label="Recherche"><input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° ou client…" className={inputClass} /></FormField>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={enCours} onChange={(e) => setEnCours(e.target.checked)} className="rounded" /> En cours seulement</label>
        <button type="button" onClick={() => setModal({ type: 'nouvelle' })} className="ml-auto flex items-center gap-2 px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-lg"><PlusIcon className="w-5 h-5" /> Nouvelle proforma</button>
      </div>
      <Carte
        titre="Proformas"
        icone={DocumentDuplicateIcon}
        sous={[
          `${proformas.length} pièce(s)`,
          enCours ? 'en cours seulement' : 'tous statuts',
          recherche.trim() ? `recherche « ${recherche.trim()} »` : null,
        ].filter(Boolean).join(' · ')}
        sousEntier
        nu
      >
        <div className="overflow-x-auto">
        <table className="tableau">
          <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">N°</th><th className="px-3 py-2 text-left">Client</th><th className="px-3 py-2 text-right">Lignes</th><th className="px-3 py-2 text-right">Total TTC</th><th className="px-3 py-2 text-left">Validité</th><th className="px-3 py-2 text-left">Statut</th><th className="px-3 py-2 text-left">Vente</th><th className="px-3 py-2 text-center">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {affiches.map((p) => (
              <tr key={p.id} className="hover:bg-neutral-50">
                <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(p.date_proforma)}</td>
                <td className="px-3 py-2 text-sm font-mono">{p.numero}</td>
                <td className="px-3 py-2 text-sm font-medium">{p.client_libelle}</td>
                <td className="px-3 py-2 text-sm text-right font-mono">{p.nombre_lignes}</td>
                <td className="px-3 py-2 text-sm text-right font-mono font-semibold">{formaterFcfa(p.total_ttc)}</td>
                <td className="px-3 py-2 text-sm text-neutral-600">{p.date_validite ? formaterDate(p.date_validite) : '—'}</td>
                <td className="px-3 py-2 text-sm"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUT_STYLE[p.statut]}`}>{LIBELLES_STATUT_PROFORMA[p.statut]}</span></td>
                <td className="px-3 py-2 text-sm font-mono text-neutral-600">{p.vente_numero ?? '—'}</td>
                <td className="px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-0.5">
                    <button onClick={() => setModal({ type: 'detail', p })} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title="Détail"><EyeIcon className="w-4 h-4" /></button>
                    <Bouton onClick={() => setModal({ type: 'imprimer', p })} icone={PrinterIcon} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-700" title="Imprimer"></Bouton>
                    {p.statut === 'EN_COURS' && <BoutonFacturer proforma={p} />}
                    {p.statut === 'EN_COURS' && <button onClick={() => annuler(p)} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Annuler la proforma"><XCircleIcon className="w-4 h-4" /></button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && proformas.length === 0 && <div className="text-center py-12 text-neutral-400">Aucune proforma.</div>}
      </Carte>

      <Pagination etat={pages} nom="proforma" data-testid="pagination-proformas" />

      {modal?.type === 'nouvelle' && <NouvelleProformaModal filialeId={filialeId} clientId={clientId} onClose={() => setModal(null)} />}
      {modal?.type === 'detail' && <DetailProformaModal proforma={modal.p} onClose={() => setModal(null)} onImprimer={() => setModal({ type: 'imprimer', p: modal.p })} />}
      {modal?.type === 'imprimer' && <ProformaImprimable proforma={modal.p} filiale={filiale} onClose={() => setModal(null)} />}
    </div>
  );
}
