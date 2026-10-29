import { useEffect, useMemo, useState } from 'react';
import { ArchiveBoxIcon, InboxStackIcon, MinusIcon, PlusIcon, TrashIcon, TruckIcon, UserIcon } from '@heroicons/react/24/outline';
import { calculerLigne, calculerTotaux, type FormatImpression, type LivraisonDemande } from '../../../core/ventes';
import ChampMontant from '../../components/ui/ChampMontant';
import { formaterFcfa } from '../../hooks/useFormatage';
import { usePOSStore } from '../../stores/pos.store';
import { brouillonsDeLaFiliale, useBrouillonsStore } from '../../stores/brouillons.store';
import { useNotifier } from '../../notifications/useNotifier';
import BrouillonsModal from './BrouillonsModal';
import ClientSelector from './ClientSelector';
import LivraisonModal from './LivraisonModal';
import PaiementModal from './PaiementModal';
import type { ContexteVente } from '../../../infrastructure/powersync/repositories/VentesRepository';

interface Props {
  ctx: ContexteVente;
  /** Nom du dépôt de vente, imprimé sur la facture A4. */
  depot: string;
  format: FormatImpression;
  peutForcerStock: boolean;
}

/**
 * Ticket en cours : lignes, client, remise, totaux, livraison, validation (F11),
 * mise en brouillon (F9) et nouvelle vente (F10).
 *
 * La remise se saisit **en francs et sur la vente entière** : c'est ainsi
 * qu'elle se négocie au comptoir (voir `calculerTotaux`). Les lignes n'ont plus
 * de champ de remise — une proforma reprise ici peut en porter, et elle reste
 * alors calculée, mais le caissier n'a plus à ventiler à la main.
 */
export default function TicketPanel({ ctx, depot, format, peutForcerStock }: Props) {
  const { lignes, client, remise, remiseAuto, setRemise, modifierQuantite, supprimerLigne, viderPanier, reprendreBrouillon } = usePOSStore();
  const { brouillons, enregistrer, supprimer } = useBrouillonsStore();
  const notifier = useNotifier();
  const [modal, setModal] = useState<'client' | 'livraison' | 'paiement' | 'brouillons' | null>(null);
  const [livraison, setLivraison] = useState<LivraisonDemande | null>(null);
  const totaux = calculerTotaux(lignes, remise);
  const mesBrouillons = useMemo(() => brouillonsDeLaFiliale(brouillons, ctx.filialeId), [brouillons, ctx.filialeId]);

  const nouvelleVente = () => { viderPanier(); setLivraison(null); };

  /**
   * Met le ticket de côté. Rien n'est vendu, rien ne sort du stock : le
   * brouillon reste sur ce poste jusqu'à ce qu'on le reprenne ou qu'on le jette.
   */
  const mettreEnBrouillon = () => {
    if (lignes.length === 0) return;
    // De quoi reconnaître le ticket d'un coup d'œil : le client s'il y en a un,
    // sinon ce qu'il y a dedans. Deux tickets mis de côté dans la même minute
    // porteraient sinon le même nom.
    const libelle = client?.raison_sociale
      ?? `${lignes[0]!.designation}${lignes.length > 1 ? ` +${lignes.length - 1}` : ''}`;
    enregistrer({
      id: `${Date.now()}`,
      libelle,
      filialeId: ctx.filialeId,
      lignes,
      client,
      remise,
      remiseAuto,
      cree_le: new Date().toISOString(),
      total_ttc: totaux.total_ttc,
      articles: totaux.nombre_articles,
    });
    nouvelleVente();
    notifier('succes', `Vente mise en brouillon (${libelle}). Reprenez-la quand vous voulez.`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'F11' && lignes.length > 0 && !modal) { e.preventDefault(); setModal('paiement'); }
      if (e.key === 'F10' && !modal) { e.preventDefault(); viderPanier(); setLivraison(null); }
      if (e.key === 'F9' && lignes.length > 0 && !modal) { e.preventDefault(); mettreEnBrouillon(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <>
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm flex flex-col h-full min-h-0">
        <div className="bg-primary-700 text-white px-5 py-3 rounded-t-xl flex items-center justify-between">
          <div>
            <p className="text-xs text-primary-200 uppercase tracking-wide">Ticket en cours</p>
            <p className="text-sm font-mono">{ctx.caisseCode} · {totaux.nombre_articles} article(s)</p>
          </div>
          <p className="text-xl font-bold font-mono" data-testid="ticket-total">{formaterFcfa(totaux.total_ttc)}</p>
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
                      {ligne.remise_percent > 0 && (
                        <span className="text-xs text-orange-600" title="Remise venue de la proforma">−{ligne.remise_percent} %</span>
                      )}
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
            <label htmlFor="remise-vente" className="text-neutral-600">
              Remise sur la vente
              {remiseAuto && client && client.remise_percent > 0 && (
                <span className="ml-1 text-xs text-neutral-400">({client.remise_percent} % client)</span>
              )}
            </label>
            <div className="flex items-center gap-1">
              <ChampMontant
                id="remise-vente"
                valeur={remise}
                onChange={setRemise}
                zeroVide
                placeholder="0"
                data-testid="remise-globale"
                className="w-28 rounded border border-neutral-200 px-2 py-1 text-right font-mono text-sm"
              />
              <span className="text-xs text-neutral-400">F</span>
            </div>
          </div>
          {remise > totaux.remise_accordee && (
            <p className="text-right text-xs text-orange-600" data-testid="remise-plafonnee">
              Ramenée à {formaterFcfa(totaux.remise_accordee)} : on ne remise pas plus que le ticket.
            </p>
          )}
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
          <div className="flex gap-2">
            <button onClick={mettreEnBrouillon} disabled={lignes.length === 0} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-50 py-2 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-50" data-testid="mettre-en-brouillon">
              <ArchiveBoxIcon className="h-4 w-4" /> BROUILLON (F9)
            </button>
            <button onClick={() => setModal('brouillons')} className="flex items-center justify-center gap-1.5 rounded-lg bg-neutral-100 px-3 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-200" data-testid="ouvrir-brouillons">
              <InboxStackIcon className="h-4 w-4" />
              {mesBrouillons.length > 0 && <span className="font-mono">{mesBrouillons.length}</span>}
            </button>
          </div>
          <button onClick={nouvelleVente} disabled={lignes.length === 0 && !client} className="w-full py-2 bg-neutral-100 hover:bg-neutral-200 disabled:opacity-50 text-neutral-700 font-medium rounded-lg transition-colors text-sm">
            NOUVELLE VENTE (F10)
          </button>
        </div>
      </div>

      {modal === 'client' && <ClientSelector onClose={() => setModal(null)} />}
      {modal === 'brouillons' && (
        <BrouillonsModal
          brouillons={mesBrouillons}
          ticketEnCours={lignes.length > 0}
          onReprendre={(b) => { reprendreBrouillon(b); supprimer(b.id); setLivraison(null); setModal(null); }}
          onSupprimer={supprimer}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'livraison' && <LivraisonModal initiale={livraison} onClose={() => setModal(null)} onValider={(l) => { setLivraison(l); setModal(null); }} />}
      {modal === 'paiement' && (
        <PaiementModal ctx={ctx} depot={depot} format={format} livraison={livraison} peutForcerStock={peutForcerStock} onClose={() => setModal(null)} onTerminee={() => { setModal(null); setLivraison(null); }} />
      )}
    </>
  );
}
