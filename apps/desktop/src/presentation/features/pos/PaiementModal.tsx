import { useMemo, useState } from 'react';
import { CheckCircleIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { MODES_PAIEMENT, type ModePaiement } from '@quinca/shared-types';
import { disponibiliteCredit } from '../../../core/clients';
import { StockInsuffisantError } from '../../../core/stock';
import {
  LIBELLES_MODE_PAIEMENT,
  VenteInvalideError,
  calculerTotaux,
  preparerVente,
  type LignePanier,
  type LivraisonDemande,
  type VentePreparee,
} from '../../../core/ventes';
import type { Client } from '../../../core/clients';
import { VentesRepository, type ContexteVente } from '../../../infrastructure/powersync/repositories/VentesRepository';
import Modal from '../../components/ui/Modal';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useNotifier } from '../../notifications/useNotifier';
import { usePOSStore } from '../../stores/pos.store';
import TicketImprimable from './TicketImprimable';

interface Props {
  ctx: ContexteVente;
  livraison: LivraisonDemande | null;
  peutForcerStock: boolean;
  onClose: () => void;
  onTerminee: () => void;
}

const COUPURES = [500, 1000, 2000, 5000, 10000];

/** Paiement puis confirmation : la vente est enregistrée en une transaction locale, le ticket peut être imprimé. */
export default function PaiementModal({ ctx, livraison, peutForcerStock, onClose, onTerminee }: Props) {
  const repository = useRepository(VentesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();
  const { filiale } = useFilialeCourante();
  const { lignes, client, remiseGlobale, proforma, viderPanier } = usePOSStore();
  const totaux = useMemo(() => calculerTotaux(lignes, remiseGlobale), [lignes, remiseGlobale]);

  const [mode, setMode] = useState<ModePaiement>('ESPECES');
  const [montantPercu, setMontantPercu] = useState<number>(totaux.total_ttc);
  const [enCours, setEnCours] = useState(false);
  const [terminee, setTerminee] = useState<{ preparee: VentePreparee; lignes: LignePanier[]; client: Client | null; date: Date } | null>(null);

  const modesDisponibles = MODES_PAIEMENT.filter((m) => m !== 'CREDIT' || (client && client.plafond_credit > 0));

  const apercu = useMemo(() => {
    try {
      return { ok: true as const, v: preparerVente({ lignes, remise_globale_percent: remiseGlobale, client, paiement: { mode_paiement: mode, montant_percu: montantPercu }, livraison, notes: '' }, ctx.caisseCode) };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Vente invalide' };
    }
  }, [lignes, remiseGlobale, client, mode, montantPercu, livraison, ctx.caisseCode]);

  const encaisser = async (forcerStock = false) => {
    setEnCours(true);
    try {
      const { preparee } = await repository.enregistrer(
        { ...ctx, autoriserStockNegatif: forcerStock, proformaId: proforma?.id ?? null },
        { lignes, remise_globale_percent: remiseGlobale, client, paiement: { mode_paiement: mode, montant_percu: montantPercu }, livraison, notes: '' },
      );
      setTerminee({ preparee, lignes, client, date: new Date() });
      viderPanier();
      notifier('succes', `Vente ${preparee.numero} enregistrée${proforma ? ` (proforma ${proforma.numero} facturée)` : ''}.`);
    } catch (error) {
      if (error instanceof StockInsuffisantError) {
        const article = lignes.find((l) => l.article_id === error.articleId);
        const msg = `Stock insuffisant pour ${article?.designation ?? 'un article'} : ${error.disponible} disponible(s), ${error.demande} demandé(s).`;
        if (peutForcerStock && !forcerStock) {
          const forcer = await confirmer({ titre: 'Stock insuffisant', message: `${msg}\n\nVendre quand même ? Le stock passera en négatif.`, libelleConfirmer: 'Vendre quand même', danger: true });
          if (forcer) { setEnCours(false); return encaisser(true); }
        }
        notifier('erreur', msg);
      } else if (error instanceof VenteInvalideError) {
        notifier('erreur', error.message);
      } else {
        notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
      }
    } finally {
      setEnCours(false);
    }
  };

  if (terminee) {
    const p = terminee.preparee;
    return (
      <Modal titre="Vente enregistrée" largeur="max-w-md" onClose={onTerminee} pied={
        <>
          <button type="button" onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg"><PrinterIcon className="w-4 h-4" /> Imprimer le ticket</button>
          <button type="button" onClick={onTerminee} autoFocus className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg">Nouvelle vente (F10)</button>
        </>
      }>
        <div className="text-center space-y-3">
          <CheckCircleIcon className="w-14 h-14 text-green-600 mx-auto" />
          <p className="font-mono text-lg font-bold">{p.numero}</p>
          <p className="text-3xl font-bold font-mono text-primary-700">{formaterFcfa(p.totaux.total_ttc)}</p>
          <p className="text-sm text-neutral-600">{LIBELLES_MODE_PAIEMENT[p.mode_paiement]} · perçu {formaterFcfa(p.montant_percu)}</p>
          {p.monnaie > 0 && <p className="text-xl font-semibold text-green-700">Rendu : <span className="font-mono">{formaterFcfa(p.monnaie)}</span></p>}
          {p.reste_a_payer > 0 && <p className="text-sm text-orange-700">Reste dû par le client : <span className="font-mono font-semibold">{formaterFcfa(p.reste_a_payer)}</span></p>}
          {livraison && <p className="text-xs text-neutral-500">Bon de livraison créé pour le {livraison.date_livraison_prevue}.</p>}
        </div>
        <TicketImprimable
          preparee={p}
          lignes={terminee.lignes}
          client={terminee.client}
          filiale={{ nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone }}
          caisse={ctx.caisseCode}
          vendeur={utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom}`.trim() : ''}
          date={terminee.date}
        />
      </Modal>
    );
  }

  return (
    <Modal
      titre="Encaissement"
      sousTitre={client ? `${client.raison_sociale} · crédit disponible ${formaterFcfa(disponibiliteCredit(client))}` : 'Client comptoir'}
      largeur="max-w-lg"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Retour</button>
          <button type="button" onClick={() => encaisser()} disabled={enCours || !apercu.ok} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-semibold rounded-lg">
            Valider la vente
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-center text-3xl font-bold font-mono text-primary-700">{formaterFcfa(totaux.total_ttc)}</p>

        <div className="grid grid-cols-2 gap-2">
          {modesDisponibles.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); if (m !== 'ESPECES') setMontantPercu(totaux.total_ttc); }}
              className={`py-3 px-4 rounded-lg font-medium text-sm border-2 transition-colors ${mode === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 hover:border-primary-300 text-neutral-700'}`}
            >
              {LIBELLES_MODE_PAIEMENT[m]}
            </button>
          ))}
        </div>

        {mode !== 'CREDIT' && (
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">{mode === 'ESPECES' ? 'Montant remis par le client' : 'Montant perçu'}</label>
            <input
              type="number"
              min="0"
              step="1"
              value={montantPercu}
              autoFocus
              onChange={(e) => setMontantPercu(Number(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter' && apercu.ok) encaisser(); }}
              className="w-full px-4 py-3 border border-neutral-200 rounded-lg text-2xl text-right font-mono focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {mode === 'ESPECES' && (
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" onClick={() => setMontantPercu(totaux.total_ttc)} className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-medium">Compte juste</button>
                {COUPURES.map((c) => (
                  <button key={c} type="button" onClick={() => setMontantPercu((m) => m + c)} className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-xs font-mono">+{c.toLocaleString('fr-FR')}</button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className={`rounded-lg p-3 text-sm ${apercu.ok ? 'bg-neutral-50 border border-neutral-200' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {apercu.ok ? (
            <div className="space-y-1">
              {apercu.v.monnaie > 0 && <div className="flex justify-between text-green-700 font-semibold"><span>Monnaie à rendre</span><span className="font-mono">{formaterFcfa(apercu.v.monnaie)}</span></div>}
              {apercu.v.reste_a_payer > 0 && <div className="flex justify-between text-orange-700"><span>Reste dû (créance client)</span><span className="font-mono font-semibold">{formaterFcfa(apercu.v.reste_a_payer)}</span></div>}
              {apercu.v.monnaie === 0 && apercu.v.reste_a_payer === 0 && <div className="flex justify-between text-neutral-700"><span>Encaissé</span><span className="font-mono">{formaterFcfa(apercu.v.montant_encaisse)}</span></div>}
            </div>
          ) : (
            apercu.message
          )}
        </div>
      </div>
    </Modal>
  );
}
