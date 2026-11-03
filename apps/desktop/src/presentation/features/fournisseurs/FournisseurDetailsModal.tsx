import { useState } from 'react';
import { BanknotesIcon, PencilSquareIcon, PrinterIcon, TruckIcon } from '@heroicons/react/24/outline';
import Bouton from '../../components/ui/Bouton';
import { LIBELLES_TYPE_REGLEMENT } from '../../../core/clients';
import { LIBELLES_STATUT_COMMANDE, estFacturable } from '../../../core/fournisseurs';
import Modal from '../../components/ui/Modal';
import { formaterFcfa, formaterDate } from '../../hooks/useFormatage';
import AchatModal from './AchatModal';
import { FactureAchatImprimable } from './FactureAchatDocument';
import FournisseurFormModal from './FournisseurFormModal';
import ReglementFournisseurModal from './ReglementFournisseurModal';
import { useAchatsFournisseur, useFournisseur, useReglementsFournisseur } from './hooks';

function Kpi({ label, value, tone = 'text-neutral-900' }: { label: string; value: string; tone?: string }) {
  return <div className="bg-neutral-50 rounded-lg p-3 border border-neutral-200"><p className="text-xs text-neutral-500">{label}</p><p className={`text-lg font-bold font-mono ${tone}`}>{value}</p></div>;
}

/** Fiche fournisseur : situation, achats réceptionnés, règlements, actions. */
export default function FournisseurDetailsModal({ filialeId, filiale, fournisseurId, onClose }: { filialeId: string; filiale: { nom: string; adresse?: string | null; telephone?: string | null }; fournisseurId: string; onClose: () => void }) {
  const fournisseur = useFournisseur(fournisseurId);
  const achats = useAchatsFournisseur(fournisseurId);
  const reglements = useReglementsFournisseur(fournisseurId);
  const [modal, setModal] = useState<'modifier' | 'achat' | 'reglement' | null>(null);
  const [facture, setFacture] = useState<string | null>(null);
  if (!fournisseur) return null;

  return (
    <>
      <Modal titre={fournisseur.raison_sociale} sousTitre={`${fournisseur.code} · ${fournisseur.telephone || '—'} · ${fournisseur.email || '—'}${fournisseur.numero_compte ? ` · compte ${fournisseur.numero_compte}` : ''}`} largeur="max-w-4xl" onClose={onClose} pied={
        <>
          <button type="button" onClick={() => setModal('modifier')} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PencilSquareIcon className="w-4 h-4" /> Modifier</button>
          <button type="button" onClick={() => setModal('achat')} className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg"><TruckIcon className="w-4 h-4" /> Réceptionner un achat</button>
          <button type="button" onClick={() => setModal('reglement')} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"><BanknotesIcon className="w-4 h-4" /> Payer</button>
        </>
      }>
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Kpi label="Dette d'ouverture" value={formaterFcfa(fournisseur.solde_initial)} />
            <Kpi label="Cumul achats" value={formaterFcfa(fournisseur.cumul_factures)} />
            <Kpi label="Cumul règlements" value={formaterFcfa(fournisseur.cumul_reglements)} tone="text-green-700" />
            <Kpi label="Dette actuelle" value={formaterFcfa(fournisseur.solde_actuel)} tone={fournisseur.solde_actuel > 0 ? 'text-red-600' : 'text-green-700'} />
          </div>
          <section>
            <h4 className="text-sm font-semibold text-neutral-800 mb-2">Achats ({achats.length})</h4>
            {achats.length === 0 ? <p className="text-sm text-neutral-400">Aucun achat.</p> : (
              <table className="tableau text-sm"><thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Numéro</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Statut</th><th className="px-3 py-2 text-right">Total TTC</th><th className="px-3 py-2 text-right">Payé</th><th className="px-3 py-2 text-right">Reste</th><th className="px-3 py-2 text-center">Facture</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">{achats.map((a) => (
                  <tr key={a.id}><td className="px-3 py-2 font-mono">{a.numero}</td><td className="px-3 py-2">{formaterDate(a.date_commande)}</td><td className="px-3 py-2">{LIBELLES_STATUT_COMMANDE[a.statut]}</td><td className="px-3 py-2 text-right font-mono">{formaterFcfa(a.total_ttc)}</td><td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(a.montant_paye)}</td><td className={`px-3 py-2 text-right font-mono ${a.reste_a_payer > 0 ? 'text-red-600' : ''}`}>{formaterFcfa(a.reste_a_payer)}</td>
                  <td className="px-3 py-2 text-center">{estFacturable(a) && <Bouton onClick={() => setFacture(a.id)} icone={PrinterIcon} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-600" title="Imprimer la facture d'achat" data-testid={`facture-achat-${a.numero}`}></Bouton>}</td></tr>
                ))}</tbody></table>
            )}
          </section>
          <section>
            <h4 className="text-sm font-semibold text-neutral-800 mb-2">Règlements ({reglements.length})</h4>
            {reglements.length === 0 ? <p className="text-sm text-neutral-400">Aucun règlement.</p> : (
              <table className="tableau text-sm"><thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Numéro</th><th className="px-3 py-2 text-left">Date</th><th className="px-3 py-2 text-left">Mode</th><th className="px-3 py-2 text-left">Caisse</th><th className="px-3 py-2 text-left">Référence</th><th className="px-3 py-2 text-right">Montant</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">{reglements.map((r) => (
                  <tr key={r.id}><td className="px-3 py-2 font-mono">{r.numero}</td><td className="px-3 py-2">{formaterDate(r.date_reglement)}</td><td className="px-3 py-2">{LIBELLES_TYPE_REGLEMENT[r.type_reglement]}</td><td className="px-3 py-2 text-neutral-600">{r.caisse_nom ?? '—'}</td><td className="px-3 py-2 text-neutral-600">{r.reference ?? '—'}</td><td className="px-3 py-2 text-right font-mono text-green-700">{formaterFcfa(r.montant)}</td></tr>
                ))}</tbody></table>
            )}
          </section>
        </div>
      </Modal>
      {modal === 'modifier' && <FournisseurFormModal filialeId={filialeId} fournisseur={fournisseur} onClose={() => setModal(null)} />}
      {modal === 'achat' && <AchatModal filialeId={filialeId} filiale={filiale} fournisseur={fournisseur} onClose={() => setModal(null)} />}
      {facture && <FactureAchatImprimable commandeId={facture} filiale={filiale} onClose={() => setFacture(null)} />}
      {modal === 'reglement' && <ReglementFournisseurModal filialeId={filialeId} fournisseur={fournisseur} onClose={() => setModal(null)} />}
    </>
  );
}
