import { useState } from 'react';
import { flushSync } from 'react-dom';
import { DocumentTextIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import {
  LIBELLES_MODE_PAIEMENT, LIBELLES_STATUT_VENTE, avoirClient, lignesFactureDepuisVente,
  recapVenteEnregistree, venteModifiable,
} from '../../../core/ventes';
import type { ModePaiement, StatutVente } from '@quinca/shared-types';
import Bouton from '../../components/ui/Bouton';
import type { VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';
import Modal from '../../components/ui/Modal';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { useDepots } from '../articles/hooks';
import { useClient } from '../clients/hooks';
import FactureVente from '../pos/FactureVente';
import AnnulationVenteModal from './AnnulationVenteModal';
import VenteEditionModal from './VenteEditionModal';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useLignesVente } from './hooks';

export const STATUT_VENTE_STYLE: Record<StatutVente, string> = {
  EN_ATTENTE: 'bg-orange-100 text-orange-700',
  VALIDEE: 'bg-green-100 text-green-700',
  ANNULEE: 'bg-red-100 text-red-700',
};

export function formaterDateHeure(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** Détail d'un ticket : lignes, montants, annulation (avec motif) si en attente. */
export default function VenteDetailsModal({ vente, filialeId, peutAnnuler, onClose }: { vente: VenteVueRow; filialeId: string; peutAnnuler: boolean; onClose: () => void }) {
  const lignes = useLignesVente(vente.id);
  const { filiale } = useFilialeCourante();
  const client = useClient(vente.client_id);
  const { depots } = useDepots(filialeId);
  const [annulation, setAnnulation] = useState(false);
  const [facture, setFacture] = useState(false);
  const [correction, setCorrection] = useState(false);
  const statut = (vente.statut ?? 'EN_ATTENTE') as StatutVente;
  // Une vente sans date n'est pas une facture : rien à rééditer.
  const dateVente = vente.date_vente ? new Date(vente.date_vente) : null;

  /** Réédition de la facture : le document doit être dans le DOM avant la boîte d'impression. */
  const imprimerFacture = () => {
    flushSync(() => setFacture(true));
    window.print();
  };

  return (
    <Modal
      titre={`Ticket ${vente.numero}`}
      sousTitre={`${formaterDateHeure(vente.date_vente)} · ${vente.caisse_nom ?? ''} · ${[vente.utilisateur_prenom, vente.utilisateur_nom].filter(Boolean).join(' ')}`}
      largeur="max-w-3xl"
      onClose={onClose}
      pied={
        <>
          {peutAnnuler && venteModifiable(statut) && (
            <button type="button" onClick={() => setAnnulation(true)} className="mr-auto px-4 py-2 text-red-600 hover:bg-red-50 font-medium rounded-lg" data-testid="annuler-vente">Annuler cette vente</button>
          )}
          {peutAnnuler && venteModifiable(statut) && (
            <button type="button" onClick={() => setCorrection(true)} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg" data-testid="corriger-vente">
              <PencilSquareIcon className="w-4 h-4" /> Corriger
            </button>
          )}
          <Bouton onClick={imprimerFacture} icone={DocumentTextIcon} className="flex items-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-900 disabled:bg-neutral-300 text-white font-medium rounded-lg" disabled={!dateVente} data-testid="reimprimer-facture-a4">Facture A4</Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUT_VENTE_STYLE[statut]}`}>{LIBELLES_STATUT_VENTE[statut]}</span>
          <span>Client : <strong>{vente.client_nom ?? 'Comptoir'}</strong></span>
          <span>Paiement : <strong>{LIBELLES_MODE_PAIEMENT[(vente.mode_paiement ?? 'ESPECES') as ModePaiement]}</strong></span>
          {vente.notes && <span className="text-neutral-500">· {vente.notes}</span>}
        </div>
        <table className="tableau text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Qté</th><th className="px-3 py-2 text-right">P.U. TTC</th><th className="px-3 py-2 text-right">Remise</th><th className="px-3 py-2 text-right">Total TTC</th></tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lignes.map((l) => (
              <tr key={l.id}>
                <td className="px-3 py-2"><span className="font-mono text-primary-700 mr-2">{l.code_article}</span>{l.designation}</td>
                <td className="px-3 py-2 text-right font-mono">{l.quantite}</td>
                <td className="px-3 py-2 text-right font-mono">{formaterFcfa(l.prix_unitaire_ttc)}</td>
                <td className="px-3 py-2 text-right font-mono text-neutral-500">{l.remise_percent ? `${l.remise_percent}%` : '—'}</td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{formaterFcfa(l.total_ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Total HT</p><p className="font-mono">{formaterFcfa(vente.total_net_ht)}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">TVA</p><p className="font-mono">{formaterFcfa(vente.total_tva)}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Total TTC</p><p className="font-mono font-bold text-primary-700">{formaterFcfa(vente.total_ttc)}</p></div>
          <div className="bg-neutral-50 rounded-lg p-3"><p className="text-xs text-neutral-500">Perçu / Rendu / Reste</p><p className="font-mono">{formaterFcfa(vente.montant_percu)} / {formaterFcfa(vente.monnaie)} / <span className={vente.reste_a_payer ? 'text-orange-700' : ''}>{formaterFcfa(vente.reste_a_payer)}</span></p></div>
        </div>
      </div>
      {annulation && (
        <AnnulationVenteModal
          vente={vente}
          filialeId={filialeId}
          onClose={() => setAnnulation(false)}
          onAnnulee={() => { setAnnulation(false); onClose(); }}
        />
      )}
      {correction && (
        <VenteEditionModal vente={vente} filialeId={filialeId} onClose={() => { setCorrection(false); onClose(); }} />
      )}
      {facture && dateVente && (
        <FactureVente
          numero={vente.numero ?? ''}
          numeroCourt={vente.numero_court}
          date={dateVente}
          vendeur={[vente.utilisateur_prenom, vente.utilisateur_nom].filter(Boolean).join(' ')}
          client={client}
          lignes={lignesFactureDepuisVente(lignes, (id) => depots.find((d) => d.id === id)?.nom ?? '')}
          recap={recapVenteEnregistree(vente, avoirClient(client))}
          modePaiement={(vente.mode_paiement ?? 'ESPECES') as ModePaiement}
          filiale={{ nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone }}
          mention={statut === 'ANNULEE' ? 'FACTURE ANNULÉE' : undefined}
        />
      )}
    </Modal>
  );
}
