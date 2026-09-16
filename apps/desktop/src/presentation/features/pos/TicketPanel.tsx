import { useEffect, useState } from 'react';
import { MinusIcon, PlusIcon, TrashIcon, TruckIcon, UserIcon } from '@heroicons/react/24/outline';
import { calculerLigne, calculerTotaux, type LivraisonDemande } from '../../../core/ventes';
import { formaterFcfa } from '../../hooks/useFormatage';
import { usePOSStore } from '../../stores/pos.store';
import ClientSelector from './ClientSelector';
import LivraisonModal from './LivraisonModal';
import PaiementModal from './PaiementModal';
import type { ContexteVente } from '../../../infrastructure/powersync/repositories/VentesRepository';

interface Props {
  ctx: ContexteVente;
  peutForcerStock: boolean;
}

/** Ticket en cours : lignes, client, remise, totaux, livraison, validation (F11) et nouvelle vente (F10). */
export default function TicketPanel({ ctx, peutForcerStock }: Props) {
  const { lignes, client, remiseGlobale, setRemiseGlobale, modifierQuantite, modifierRemiseLigne, supprimerLigne, viderPanier } = usePOSStore();
  const [modal, setModal] = useState<'client' | 'livraison' | 'paiement' | null>(null);
  const [livraison, setLivraison] = useState<LivraisonDemande | null>(null);
  const totaux = calculerTotaux(lignes, remiseGlobale);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F11' && lignes.length > 0 && !modal) { e.preventDefault(); setModal('paiement'); }
      if (e.key === 'F10' && !modal) { e.preventDefault(); viderPanier(); setLivraison(null); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lignes.length, modal, viderPanier]);

  const nouvelleVente = () => { viderPanier(); setLivraison(null); };

  return (
    <>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm flex flex-col h-full min-h-0">
        <div className="bg-primary-700 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-primary-200 uppercase tracking-wide">Ticket en cours</p>
            <p className="text-sm font-mono">{ctx.caisseCode} · {totaux.nombre_articles} article(s)</p>
          </div>
          <p className="text-xl font-bold font-mono">{formaterFcfa(totaux.total_ttc)}</p>
        </div>

        <button onClick={() => setModal('client')} className="px-5 py-3 border-b border-neutral-100 flex items-center gap-3 hover:bg-neutral-50 transition-colors w-full text-left">
          <UserIcon className="w-5 h-5 text-primary-600" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-neutral-500 uppercase font-medium">Client</p>
            <p className="text-sm font-medium text-neutral-900 truncate">{client ? client.raison_sociale : 'Client comptoir'}</p>
          </div>
          {client && client.solde_actuel !== 0 && (
            <span className={`text-xs font-mono ${client.solde_actuel > 0 ? 'text-red-600' : 'text-blue-700'}`}>{formaterFcfa(client.solde_actuel)}</span>
          )}
        </button>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" data-testid="ticket-lignes">
          {lignes.length === 0 ? (
            <div className="text-center py-12 text-neutral-400">
              <p className="text-4xl mb-2">🛒</p>
              <p className="text-sm">Panier vide</p>
              <p className="text-xs mt-1">Cliquez sur un article pour l'ajouter</p>
            </div>
          ) : (
            lignes.map((ligne) => {
              const l = calculerLigne(ligne);
              return (
                <div key={ligne.article_id} className="bg-neutral-50 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-sm font-medium text-neutral-900 flex-1">{ligne.designation}</p>
                    <button onClick={() => supprimerLigne(ligne.article_id)} className="text-red-500 hover:bg-red-50 p-1 rounded" title="Retirer"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button onClick={() => modifierQuantite(ligne.article_id, ligne.quantite - 1)} className="w-7 h-7 rounded bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100"><MinusIcon className="w-3 h-3" /></button>
                      <input type="number" min="0" step="any" value={ligne.quantite} onChange={(e) => modifierQuantite(ligne.article_id, Number(e.target.value))} className="w-14 text-center text-sm font-bold border border-neutral-200 rounded py-1" />
                      <button onClick={() => modifierQuantite(ligne.article_id, ligne.quantite + 1)} className="w-7 h-7 rounded bg-white border border-neutral-200 flex items-center justify-center hover:bg-neutral-100"><PlusIcon className="w-3 h-3" /></button>
                      <span className="text-xs text-neutral-500 ml-1 whitespace-nowrap">× {formaterFcfa(ligne.prix_unitaire_ttc)}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <input type="number" min="0" max="100" value={ligne.remise_percent} onChange={(e) => modifierRemiseLigne(ligne.article_id, Number(e.target.value))} title="Remise ligne %" className="w-12 text-right text-xs border border-neutral-200 rounded py-1 px-1" />
                      <span className="text-xs text-neutral-400">%</span>
                      <p className="text-sm font-bold font-mono text-primary-700 text-right whitespace-nowrap ml-1">{formaterFcfa(l.total_ttc)}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-neutral-200 px-5 py-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <label className="text-neutral-600">Remise globale (%)</label>
            <input type="number" min="0" max="100" value={remiseGlobale} onChange={(e) => setRemiseGlobale(Number(e.target.value))} className="w-20 text-right border border-neutral-200 rounded px-2 py-1 text-sm" />
          </div>
          <div className="flex justify-between"><span className="text-neutral-600">Total HT</span><span className="font-mono">{formaterFcfa(totaux.total_net_ht)}</span></div>
          {totaux.total_remise > 0 && <div className="flex justify-between text-orange-600"><span>Remise</span><span className="font-mono">−{formaterFcfa(totaux.total_remise)}</span></div>}
          <div className="flex justify-between"><span className="text-neutral-600">TVA</span><span className="font-mono">{formaterFcfa(totaux.total_tva)}</span></div>
          <div className="flex justify-between text-lg font-bold pt-1 border-t border-neutral-100"><span>TOTAL TTC</span><span className="font-mono text-primary-700">{formaterFcfa(totaux.total_ttc)}</span></div>
          <button onClick={() => setModal('livraison')} className={`w-full mt-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border ${livraison ? 'bg-primary-50 border-primary-300 text-primary-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'}`}>
            <TruckIcon className="w-4 h-4" /> {livraison ? `Livraison le ${livraison.date_livraison_prevue}` : 'Ajouter une livraison'}
          </button>
        </div>

        <div className="p-4 border-t border-neutral-200 space-y-2">
          <button onClick={() => setModal('paiement')} disabled={lignes.length === 0} className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-semibold rounded-lg transition-colors">
            ENCAISSER (F11)
          </button>
          <button onClick={nouvelleVente} disabled={lignes.length === 0 && !client} className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 font-medium rounded-lg transition-colors text-sm">
            NOUVELLE VENTE (F10)
          </button>
        </div>
      </div>

      {modal === 'client' && <ClientSelector onClose={() => setModal(null)} />}
      {modal === 'livraison' && <LivraisonModal initiale={livraison} onClose={() => setModal(null)} onValider={(l) => { setLivraison(l); setModal(null); }} />}
      {modal === 'paiement' && (
        <PaiementModal ctx={ctx} livraison={livraison} peutForcerStock={peutForcerStock} onClose={() => setModal(null)} onTerminee={() => { setModal(null); setLivraison(null); }} />
      )}
    </>
  );
}
