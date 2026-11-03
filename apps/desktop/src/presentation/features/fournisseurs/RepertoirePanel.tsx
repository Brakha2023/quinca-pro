import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BanknotesIcon, DocumentTextIcon, EnvelopeIcon, EyeIcon, MagnifyingGlassIcon, PencilSquareIcon, ScaleIcon, TruckIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { Fournisseur } from '../../../core/fournisseurs';
import { FournisseursRepository } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import DocumentImprimable from '../../components/print/DocumentImprimable';
import { usePermissions } from '../../auth/usePermissions';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { cheminFournisseurs } from '../../pages/Fournisseurs/onglets';
import AchatModal from './AchatModal';
import FournisseurDetailsModal from './FournisseurDetailsModal';
import FournisseurFormModal from './FournisseurFormModal';
import ReglementFournisseurModal from './ReglementFournisseurModal';
import { useFournisseurs } from './hooks';

type ModalState = { type: 'details'; id: string } | { type: 'modifier'; f: Fournisseur } | { type: 'achat'; f: Fournisseur } | { type: 'reglement'; f: Fournisseur } | { type: 'balance' } | null;

interface Props {
  filialeId: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
}

/** Répertoire des fournisseurs : situation des comptes, actions rapides, balance générale imprimable. */
export default function RepertoirePanel({ filialeId, filiale }: Props) {
  const repository = useRepository(FournisseursRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const navigate = useNavigate();
  const [recherche, setRecherche] = useState('');
  const [avecDette, setAvecDette] = useState(false);
  const [inclureInactifs, setInclureInactifs] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);
  /** Fiche en cours de vérification au serveur : les boutons attendent la réponse. */
  const [verification, setVerification] = useState<string | null>(null);
  const { peut } = usePermissions();
  const { fournisseurs, isLoading } = useFournisseurs(filialeId, { recherche, avecDette, inclureInactifs });
  const totaux = fournisseurs.reduce(
    (t, f) => ({ initial: t.initial + f.solde_initial, factures: t.factures + f.cumul_factures, reglements: t.reglements + f.cumul_reglements, solde: t.solde + f.solde_actuel, dettes: t.dettes + Math.max(f.solde_actuel, 0) }),
    { initial: 0, factures: 0, reglements: 0, solde: 0, dettes: 0 },
  );

  const basculerActif = async (f: Fournisseur) => {
    if (f.est_actif && f.solde_actuel !== 0) { notifier('erreur', "Impossible de désactiver un fournisseur dont le compte n'est pas soldé."); return; }
    if (!(await confirmer({ message: `${f.est_actif ? 'Désactiver' : 'Réactiver'} ${f.raison_sociale} ?`, libelleConfirmer: f.est_actif ? 'Désactiver' : 'Réactiver', danger: f.est_actif }))) return;
    try { await repository.setActif(f.id, !f.est_actif); notifier('succes', `${f.raison_sociale} ${f.est_actif ? 'désactivé' : 'réactivé'}.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.'); }
  };

  /**
   * Suppression définitive, réservée aux fiches qui n'ont jamais servi.
   * Vérifiée au serveur avant toute question (voir
   * `FournisseursRepository.motifDeRefus`), d'où l'attente affichée.
   */
  const supprimer = async (f: Fournisseur) => {
    setVerification(f.id);
    try {
      const motif = await repository.motifDeRefus(f);
      if (motif) { notifier('erreur', motif); return; }

      const ok = await confirmer({
        titre: `Supprimer ${f.code}`,
        message: `La fiche de « ${f.raison_sociale} » disparaîtra du répertoire, sur ce poste comme sur les autres. Ce fournisseur n'a jamais servi : rien d'autre ne s'efface avec lui. Cette opération ne se défait pas.`,
        libelleConfirmer: 'Supprimer',
        danger: true,
      });
      if (!ok) return;

      await repository.supprimer(f);
      notifier('succes', `Fournisseur ${f.code} supprimé.`);
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
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Dettes fournisseurs</p><p className="text-2xl font-bold font-mono text-red-600 mt-1">{formaterFcfa(totaux.dettes)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Cumul des factures</p><p className="text-2xl font-bold font-mono mt-1">{formaterFcfa(totaux.factures)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Cumul des règlements</p><p className="text-2xl font-bold font-mono text-green-700 mt-1">{formaterFcfa(totaux.reglements)}</p></div>
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-sm"><p className="text-sm text-neutral-500">Fournisseurs à payer</p><p className="text-2xl font-bold mt-1">{fournisseurs.filter((f) => f.solde_actuel > 0).length}</p></div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[16rem] max-w-md"><MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" /><input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="N° compte, code, raison sociale ou téléphone…" className={`${inputClass} pl-10`} /></div>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={avecDette} onChange={(e) => setAvecDette(e.target.checked)} className="rounded" /> Avec dette</label>
        <label className={`${controleInlineClass} flex items-center gap-2 cursor-pointer`}><input type="checkbox" checked={inclureInactifs} onChange={(e) => setInclureInactifs(e.target.checked)} className="rounded" /> Inclure les inactifs</label>
        <button type="button" onClick={() => setModal({ type: 'balance' })} className="ml-auto flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><ScaleIcon className="w-5 h-5" /> Balance générale</button>
      </div>

      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tableau">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
              <tr>
                <th className="px-3 py-3 text-left">N° compte</th><th className="px-3 py-3 text-left">Raison sociale</th><th className="px-3 py-3 text-left">Famille</th><th className="px-3 py-3 text-left">Type article</th><th className="px-3 py-3 text-left">Téléphone</th>
                <th className="px-3 py-3 text-right">Solde initial</th><th className="px-3 py-3 text-right">Facture</th><th className="px-3 py-3 text-right">Règlement</th><th className="px-3 py-3 text-right">Solde</th><th className="px-3 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {fournisseurs.map((f) => (
                <tr key={f.id} className={`hover:bg-neutral-50 ${!f.est_actif ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 text-sm font-mono text-neutral-600">{f.numero_compte ?? f.code}</td>
                  <td className="px-3 py-2 text-sm font-medium text-neutral-900">{f.raison_sociale}{!f.est_actif && <span className="ml-2 text-xs text-neutral-500">(inactif)</span>}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{f.famille ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{f.type_article ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-neutral-600">{f.telephone ?? f.mobile ?? '—'}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(f.solde_initial)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(f.cumul_factures)}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-green-700">{formaterFcfa(f.cumul_reglements)}</td>
                  <td className={`px-3 py-2 text-sm text-right font-mono font-bold ${f.solde_actuel > 0 ? 'text-red-600' : f.solde_actuel < 0 ? 'text-blue-700' : 'text-green-700'}`}>{formaterFcfa(f.solde_actuel)}</td>
                  <td className="px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-0.5">
                      <button onClick={() => setModal({ type: 'details', id: f.id })} className={`${action} hover:bg-blue-50 text-blue-600`} title="Fiche fournisseur"><EyeIcon className="w-4 h-4" /></button>
                      <button onClick={() => setModal({ type: 'modifier', f })} className={`${action} hover:bg-neutral-100 text-neutral-700`} title="Modifier"><PencilSquareIcon className="w-4 h-4" /></button>
                      <button onClick={() => navigate(cheminFournisseurs('compte', f.id))} className={`${action} hover:bg-neutral-100 text-neutral-700`} title="Compte fournisseur"><ScaleIcon className="w-4 h-4" /></button>
                      <button onClick={() => navigate(cheminFournisseurs('commandes', f.id))} className={`${action} hover:bg-primary-50 text-primary-700`} title="Nouvelle commande"><DocumentTextIcon className="w-4 h-4" /></button>
                      <button onClick={() => setModal({ type: 'achat', f })} className={`${action} hover:bg-primary-50 text-primary-700`} title="Réceptionner un achat"><TruckIcon className="w-4 h-4" /></button>
                      <button onClick={() => setModal({ type: 'reglement', f })} className={`${action} hover:bg-green-50 text-green-700`} title="Règlement"><BanknotesIcon className="w-4 h-4" /></button>
                      <button onClick={() => navigate(cheminFournisseurs('relance', f.id))} className={`${action} hover:bg-orange-50 text-orange-600`} title="Relance par e-mail" disabled={!f.email}><EnvelopeIcon className="w-4 h-4" /></button>
                      <button onClick={() => basculerActif(f)} className={`px-2 py-1 rounded text-xs font-medium ${f.est_actif ? 'text-red-600 hover:bg-red-50' : 'text-green-700 hover:bg-green-50'}`}>{f.est_actif ? 'Désactiver' : 'Réactiver'}</button>
                      {/* Effacer n'est pas désactiver : réservé à qui tient le répertoire. */}
                      {peut('fournisseurs.ecrire') && (
                        <button onClick={() => supprimer(f)} disabled={verification !== null} className={`${action} text-red-500 hover:bg-red-50 disabled:opacity-40`} title="Supprimer définitivement (fiches jamais utilisées)" data-testid={`supprimer-fournisseur-${f.code}`}><TrashIcon className="w-4 h-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {fournisseurs.length > 0 && (
              <tfoot className="bg-neutral-50 border-t border-neutral-200 text-sm font-semibold">
                <tr>
                  <td colSpan={5} className="px-3 py-2 text-right">Somme</td>
                  <td className="px-3 py-2 text-right font-mono">{formaterFcfa(totaux.initial)}</td>
                  <td className="px-3 py-2 text-right font-mono">{formaterFcfa(totaux.factures)}</td>
                  <td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(totaux.reglements)}</td>
                  <td className={`px-3 py-2 text-right font-mono ${totaux.solde > 0 ? 'text-red-600' : 'text-green-700'}`}>{formaterFcfa(totaux.solde)}</td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {isLoading && <div className="text-center py-12 text-neutral-400">Chargement…</div>}
        {!isLoading && fournisseurs.length === 0 && <div className="text-center py-12 text-neutral-400">Aucun fournisseur.</div>}
      </div>

      {modal?.type === 'details' && <FournisseurDetailsModal filialeId={filialeId} filiale={filiale} fournisseurId={modal.id} onClose={() => setModal(null)} />}
      {modal?.type === 'modifier' && <FournisseurFormModal filialeId={filialeId} fournisseur={modal.f} onClose={() => setModal(null)} />}
      {modal?.type === 'achat' && <AchatModal filialeId={filialeId} filiale={filiale} fournisseur={modal.f} onClose={() => setModal(null)} />}
      {modal?.type === 'reglement' && <ReglementFournisseurModal filialeId={filialeId} fournisseur={modal.f} onClose={() => setModal(null)} />}
      {modal?.type === 'balance' && (
        <DocumentImprimable titre="Balance générale fournisseurs" filiale={filiale} onClose={() => setModal(null)}>
          <p>Arrêtée au {new Date().toLocaleDateString('fr-FR')} · {fournisseurs.length} fournisseur(s)</p>
          <table className="document-liste">
            <thead><tr><th>N° compte</th><th>Raison sociale</th><th>Solde initial</th><th>Facture</th><th>Règlement</th><th>Solde</th></tr></thead>
            <tbody>
              {fournisseurs.map((f) => (
                <tr key={f.id}><td>{f.numero_compte ?? f.code}</td><td>{f.raison_sociale}</td><td className="num">{formaterFcfa(f.solde_initial)}</td><td className="num">{formaterFcfa(f.cumul_factures)}</td><td className="num">{formaterFcfa(f.cumul_reglements)}</td><td className="num"><strong>{formaterFcfa(f.solde_actuel)}</strong></td></tr>
              ))}
            </tbody>
            <tfoot><tr><th colSpan={2}>Total</th><th className="num">{formaterFcfa(totaux.initial)}</th><th className="num">{formaterFcfa(totaux.factures)}</th><th className="num">{formaterFcfa(totaux.reglements)}</th><th className="num">{formaterFcfa(totaux.solde)}</th></tr></tfoot>
          </table>
        </DocumentImprimable>
      )}
    </div>
  );
}
