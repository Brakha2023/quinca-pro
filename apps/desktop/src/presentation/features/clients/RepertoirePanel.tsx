import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BanknotesIcon, DocumentDuplicateIcon, EnvelopeIcon, EyeIcon, MagnifyingGlassIcon, PencilSquareIcon, PrinterIcon, ScaleIcon, TrashIcon } from '@heroicons/react/24/outline';
import { disponibiliteCredit, statutCredit, type Client } from '../../../core/clients';
import { ClientsRepository } from '../../../infrastructure/powersync/repositories/ClientsRepository';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { usePermissions } from '../../auth/usePermissions';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { cheminClients } from '../../pages/Clients/onglets';
import ClientDetailsModal, { STATUT_CREDIT_STYLE } from './ClientDetailsModal';
import ClientFormModal from './ClientFormModal';
import ReglementModal from './ReglementModal';
import { useClients, useGroupesClients } from './hooks';

type ModalState = { type: 'details'; id: string } | { type: 'modifier'; client: Client } | { type: 'reglement'; client: Client } | { type: 'tableau' } | null;

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/** Répertoire des clients : situation des comptes (solde initial, factures, règlements, solde, disponibilité, plafond), actions, tableau imprimable. */
export default function RepertoirePanel({ filialeId, filiale }: Props) {
  const repository = useRepository(ClientsRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [groupe, setGroupe] = useState('');
  const [avecCreance, setAvecCreance] = useState(false);
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  /** Fiche en cours de vérification au serveur : les boutons attendent la réponse. */
  const [verification, setVerification] = useState<string | null>(null);
  const { peut } = usePermissions();
  const groupes = useGroupesClients(filialeId);
  const { clients, isLoading } = useClients(filialeId, { recherche, avecCreance, inclureInactifs, groupe: groupe || null });
  const totaux = clients.reduce(
    (t, c) => ({
      initial: t.initial + c.solde_initial, factures: t.factures + c.cumul_factures, reglements: t.reglements + c.cumul_reglements, solde: t.solde + c.solde_actuel,
      creances: t.creances + Math.max(c.solde_actuel, 0), avoirs: t.avoirs + Math.max(-c.solde_actuel, 0), disponibilite: t.disponibilite + disponibiliteCredit(c), plafond: t.plafond + c.plafond_credit,
    }),
    { initial: 0, factures: 0, reglements: 0, solde: 0, creances: 0, avoirs: 0, disponibilite: 0, plafond: 0 },
  );
  const depassements = clients.filter((c) => statutCredit(c) === 'DEPASSE').length;

  const basculerActif = async (client: Client) => {
    if (client.est_actif && client.solde_actuel !== 0) { notifier('erreur', 'Impossible de mettre en sommeil un client dont le compte n\'est pas soldé.'); return; }
    if (!(await confirmer({ message: `${client.est_actif ? 'Mettre en sommeil' : 'Réactiver'} le client ${client.raison_sociale} ?`, libelleConfirmer: client.est_actif ? 'Mettre en sommeil' : 'Réactiver', danger: client.est_actif }))) return;
    try {
      await repository.setActif(client.id, !client.est_actif);
      notifier('succes', `Client ${client.raison_sociale} ${client.est_actif ? 'mis en sommeil' : 'réactivé'}.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  /**
   * Suppression définitive, réservée aux fiches qui n'ont jamais servi.
   *
   * On vérifie **avant** de demander confirmation : poser une question pour
   * ensuite refuser serait une question de trop. La vérification passe par le
   * serveur (voir `ClientsRepository.motifDeRefus`), d'où l'attente affichée.
   */
  const supprimer = async (client: Client) => {
    setVerification(client.id);
    try {
      const motif = await repository.motifDeRefus(client);
      if (motif) { notifier('erreur', motif); return; }

      const ok = await confirmer({
        titre: `Supprimer ${client.code}`,
        message: `La fiche de « ${client.raison_sociale} » disparaîtra du répertoire, sur ce poste comme sur les autres. Ce client n'a jamais servi : rien d'autre ne s'efface avec lui. Cette opération ne se défait pas.`,
        libelleConfirmer: 'Supprimer',
        danger: true,
      });
      if (!ok) return;

      await repository.supprimer(client);
      notifier('succes', `Client ${client.code} supprimé.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Suppression impossible.');
    } finally {
      setVerification(null);
    }
  };

  const action = 'p-1.5 rounded';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Créances clients</p><p className="text-2xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(totaux.creances)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Avoirs (avances disponibles)</p><p className="text-2xl font-bold font-mono text-blue-700 mt-1">{formaterFcfa(totaux.avoirs)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Cumul des factures</p><p className="text-2xl font-bold font-mono mt-1">{formaterFcfa(totaux.factures)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Plafonds dépassés</p><p className={`text-2xl font-bold mt-1 ${depassements > 0 ? 'text-red-600' : ''}`}>{depassements}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[16rem] max-w-md"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" /><input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Code, n° compte, raison sociale ou téléphone…" className={`${inputClass} pl-10`} /></div>
        <select value={groupe} onChange={(e) => setGroupe(e.target.value)} className={controleInlineClass} aria-label="Groupe"><option value="">Tous les groupes</option>{groupes.map((g) => <option key={g} value={g}>{g}</option>)}</select>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={avecCreance} onChange={(e) => setAvecCreance(e.target.checked)} className="rounded" /> Avec créance</label>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={inclureInactifs} onChange={(e) => setInclureInactifs(e.target.checked)} className="rounded" /> Inclure en sommeil</label>
        <button type="button" onClick={() => setModal({ type: 'tableau' })} className="ml-auto flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-5 h-5" /> Imprimer le tableau</button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-3 text-left">Code</th><th className="px-3 py-3 text-left">Raison sociale</th><th className="px-3 py-3 text-left">Mobile</th><th className="px-3 py-3 text-left">Adresse</th>
                <th className="px-3 py-3 text-right">Solde initial</th><th className="px-3 py-3 text-right">Facture</th><th className="px-3 py-3 text-right">Règlement</th><th className="px-3 py-3 text-right">Solde</th><th className="px-3 py-3 text-right">Disponibilité</th><th className="px-3 py-3 text-right">Plafond</th>
                <th className="px-3 py-3 text-center">Statut</th><th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {clients.map((c) => {
                const statut = STATUT_CREDIT_STYLE[statutCredit(c)];
                return (
                  <tr key={c.id} className={`hover:bg-neutral-50 ${!c.est_actif ? 'opacity-50' : ''}`}>
                    <td className="px-3 py-2 text-sm font-mono text-primary-700">{c.numero_compte ?? c.code}</td>
                    <td className="px-3 py-2 text-sm font-medium text-neutral-900">{c.raison_sociale}{!c.est_actif && <span className="ml-2 text-xs text-neutral-500">(en sommeil)</span>}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{c.mobile ?? c.telephone ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600 max-w-[12rem] truncate" title={c.adresse ?? ''}>{c.adresse ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(c.solde_initial)}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(c.cumul_factures)}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{formaterFcfa(c.cumul_reglements)}</td>
                    <td className={`px-3 py-2 text-sm text-right font-mono font-bold ${c.solde_actuel > 0 ? 'text-red-600' : c.solde_actuel < 0 ? 'text-blue-700' : 'text-green-700'}`}>{formaterFcfa(c.solde_actuel)}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-blue-700">{formaterFcfa(disponibiliteCredit(c))}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(c.plafond_credit)}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statut.cls}`}>{statut.label}</span></td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <button onClick={() => setModal({ type: 'details', id: c.id })} className={`${action} hover:bg-blue-50 text-blue-600`} title="Fiche client"><EyeIcon className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ type: 'modifier', client: c })} className={`${action} hover:bg-neutral-100 text-neutral-700`} title="Modifier"><PencilSquareIcon className="w-4 h-4" /></button>
                        <button onClick={() => navigate(cheminClients('compte', c.id))} className={`${action} hover:bg-neutral-100 text-neutral-700`} title="Compte client"><ScaleIcon className="w-4 h-4" /></button>
                        <button onClick={() => navigate(cheminClients('proformas', c.id))} className={`${action} hover:bg-primary-50 text-primary-700`} title="Proforma"><DocumentDuplicateIcon className="w-4 h-4" /></button>
                        <button onClick={() => setModal({ type: 'reglement', client: c })} className={`${action} hover:bg-green-50 text-green-700`} title="Règlement / approvisionnement"><BanknotesIcon className="w-4 h-4" /></button>
                        <button onClick={() => navigate(cheminClients('relance', c.id))} className={`${action} hover:bg-orange-50 text-orange-600 disabled:opacity-30`} title="Relance par e-mail" disabled={!c.email || c.solde_actuel <= 0}><EnvelopeIcon className="w-4 h-4" /></button>
                        <button onClick={() => basculerActif(c)} className={`px-2 py-1 rounded text-xs font-medium ${c.est_actif ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>{c.est_actif ? 'Sommeil' : 'Réactiver'}</button>
                        {/* Effacer n'est pas mettre en sommeil : réservé à qui tient le répertoire. */}
                        {peut('clients.ecrire') && (
                          <button onClick={() => supprimer(c)} disabled={verification !== null} className={`${action} text-red-500 hover:bg-red-50 disabled:opacity-40`} title="Supprimer définitivement (fiches jamais utilisées)" data-testid={`supprimer-client-${c.code}`}><TrashIcon className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {clients.length > 0 && (
              <tfoot className="bg-neutral-50 border-t border-neutral-200 text-sm font-semibold">
                <tr>
                  <td colSpan={4} className="px-3 py-2 text-right">Totaux</td>
                  <td className="px-3 py-2 text-right font-mono">{formaterFcfa(totaux.initial)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formaterFcfa(totaux.factures)}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(totaux.reglements)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${totaux.solde > 0 ? 'text-red-600' : 'text-green-700'}`}>{formaterFcfa(totaux.solde)}</td>
                  <td className="px-3 py-2 text-right font-mono text-blue-700">{formaterFcfa(totaux.disponibilite)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formaterFcfa(totaux.plafond)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && clients.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun client.</div>}
      </div>

      {modal?.type === 'details' && <ClientDetailsModal filialeId={filialeId} clientId={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === 'modifier' && <ClientFormModal filialeId={filialeId} client={modal.client} onClose={() => setModal(null)} />}
      {modal?.type === 'reglement' && <ReglementModal filialeId={filialeId} client={modal.client} onClose={() => setModal(null)} />}
      {modal?.type === 'tableau' && (
        <DocumentImprimable titre="Situation des comptes clients" filiale={filiale} onClose={() => setModal(null)}>
          <p>Arrêtée au {new Date().toLocaleDateString('fr-FR')} · {clients.length} client(s){groupe ? ` · groupe ${groupe}` : ''}</p>
          <table>
            <thead><tr><th>Code</th><th>Raison sociale</th><th>Mobile</th><th>Solde initial</th><th>Facture</th><th>Règlement</th><th>Solde</th><th>Disponibilité</th><th>Plafond</th></tr></thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}><td>{c.numero_compte ?? c.code}</td><td>{c.raison_sociale}</td><td>{c.mobile ?? c.telephone ?? ''}</td><td className="num">{formaterFcfa(c.solde_initial)}</td><td className="num">{formaterFcfa(c.cumul_factures)}</td><td className="num">{formaterFcfa(c.cumul_reglements)}</td><td className="num"><strong>{formaterFcfa(c.solde_actuel)}</strong></td><td className="num">{formaterFcfa(disponibiliteCredit(c))}</td><td className="num">{formaterFcfa(c.plafond_credit)}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={3}>Totaux</th><th className="num">{formaterFcfa(totaux.initial)}</th><th className="num">{formaterFcfa(totaux.factures)}</th><th className="num">{formaterFcfa(totaux.reglements)}</th><th className="num">{formaterFcfa(totaux.solde)}</th><th className="num">{formaterFcfa(totaux.disponibilite)}</th><th className="num">{formaterFcfa(totaux.plafond)}</th></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
