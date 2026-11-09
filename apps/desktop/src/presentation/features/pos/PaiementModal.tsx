import { useMemo, useState } from 'react';
import { flushSync } from 'react-dom';
import { CheckCircleIcon, PrinterIcon } from '@heroicons/react/24/outline';
import { MODES_PAIEMENT, type ModePaiement } from '@quinca/shared-types';
import Bouton from '../../components/ui/Bouton';
import { disponibiliteCredit } from '../../../core/clients';
import { StockInsuffisantError } from '../../../core/stock';
import {
  LIBELLES_MODE_PAIEMENT,
  SORTIES_PAPIER,
  VenteInvalideError,
  avoirClient,
  calculerTotaux,
  preparerVente,
  sortieParDefaut,
  type FormatImpression,
  type LignePanier,
  type LivraisonDemande,
  type SortiePapier,
  type VentePreparee,
} from '../../../core/ventes';
import type { Client } from '../../../core/clients';
import { codePoste } from '../../../infrastructure/desktop/identitePoste';
import { VentesRepository, type ContexteVente } from '../../../infrastructure/powersync/repositories/VentesRepository';
import ChampMontant from '../../components/ui/ChampMontant';
import Modal from '../../components/ui/Modal';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useFilialeCourante } from '../../auth/useFilialeCourante';
import { useRepository } from '../../hooks/useRepository';
import { formaterDate, formaterFcfa } from '../../hooks/useFormatage';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useNotifier } from '../../notifications/useNotifier';
import { usePOSStore } from '../../stores/pos.store';
import LiasseVente from './LiasseVente';
import TicketImprimable from './TicketImprimable';

interface Props {
  ctx: ContexteVente;
  /** Nom du dépôt de vente, imprimé sur la facture A4. */
  depot: string;
  /** Sortie papier par défaut du poste : bouton principal après la vente. */
  format: FormatImpression;
  livraison: LivraisonDemande | null;
  peutForcerStock: boolean;
  onClose: () => void;
  onTerminee: () => void;
}

const COUPURES = [500, 1000, 2000, 5000, 10000];

/** Paiement puis confirmation : la vente est enregistrée en une transaction locale, le ticket peut être imprimé. */
export default function PaiementModal({ ctx, depot, format, livraison, peutForcerStock, onClose, onTerminee }: Props) {
  const repository = useRepository(VentesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();
  const { filiale } = useFilialeCourante();
  const { lignes, client, remise, proforma, viderPanier } = usePOSStore();
  const totaux = useMemo(() => calculerTotaux(lignes, remise), [lignes, remise]);

  const [mode, setMode] = useState<ModePaiement>('ESPECES');
  const [montantPercu, setMontantPercu] = useState<number>(totaux.total_ttc);
  const [enCours, setEnCours] = useState(false);
  const [terminee, setTerminee] = useState<{ preparee: VentePreparee; lignes: LignePanier[]; client: Client | null; avoir: number; date: Date; numeroLivraison: string | null; numeroCourt: string; numeroCourtLivraison: string | null } | null>(null);
  /**
   * Ce que le caissier a choisi d'envoyer à l'imprimante. Proposé d'office
   * selon le réglage du poste et la livraison demandée (voir `sortieParDefaut`),
   * et modifiable d'un clic avant d'imprimer.
   */
  const [sortie, setSortie] = useState<SortiePapier>(sortieParDefaut(format, livraison !== null));

  /**
   * Imprime la sortie demandée. Le document doit être dans le DOM avant
   * d'ouvrir la boîte d'impression du système, d'où le rendu forcé.
   */
  const imprimer = (choisi: SortiePapier) => {
    flushSync(() => setSortie(choisi));
    window.print();
  };

  const modesDisponibles = MODES_PAIEMENT.filter((m) => m !== 'CREDIT' || (client && client.plafond_credit > 0));

  const apercu = useMemo(() => {
    try {
      return { ok: true as const, v: preparerVente({ lignes, remise, client, paiement: { mode_paiement: mode, montant_percu: montantPercu }, livraison, notes: '' }, { caisse: ctx.caisseCode, code: codePoste() }) };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Vente invalide' };
    }
  }, [lignes, remise, client, mode, montantPercu, livraison, ctx.caisseCode]);

  const encaisser = async (forcerStock = false) => {
    setEnCours(true);
    try {
      const { preparee, numeroLivraison, numeroCourt, numeroCourtLivraison } = await repository.enregistrer(
        { ...ctx, autoriserStockNegatif: forcerStock, proformaId: proforma?.id ?? null },
        { lignes, remise, client, paiement: { mode_paiement: mode, montant_percu: montantPercu }, livraison, notes: '' },
      );
      setTerminee({ preparee, lignes, client, avoir: avoirClient(client), date: new Date(), numeroLivraison, numeroCourt, numeroCourtLivraison });
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
    const infosFiliale = { nom: filiale?.nom ?? 'QuincaPro', adresse: filiale?.adresse, telephone: filiale?.telephone };
    const vendeur = utilisateur ? `${utilisateur.prenom ?? ''} ${utilisateur.nom}`.trim() : '';
    return (
      <Modal titre="Vente enregistrée" largeur="max-w-md" onClose={onTerminee} pied={
        <button type="button" onClick={onTerminee} autoFocus className="px-4 py-2 bg-accent-500 hover:bg-accent-600 text-white font-medium rounded-lg">Nouvelle vente (F10)</button>
      }>
        <div className="text-center space-y-3">
          <CheckCircleIcon className="w-14 h-14 text-green-600 mx-auto" />
          <p className="font-mono text-lg font-bold">{p.numero}</p>
          <p className="text-3xl font-bold font-mono text-primary-700">{formaterFcfa(p.totaux.total_ttc)}</p>
          <p className="text-sm text-neutral-600">{LIBELLES_MODE_PAIEMENT[p.mode_paiement]} · perçu {formaterFcfa(p.montant_percu)}</p>
          {p.monnaie > 0 && <p className="text-xl font-semibold text-green-700">Rendu : <span className="font-mono">{formaterFcfa(p.monnaie)}</span></p>}
          {p.reste_a_payer > 0 && <p className="text-sm text-orange-700">Reste dû par le client : <span className="font-mono font-semibold">{formaterFcfa(p.reste_a_payer)}</span></p>}
          {livraison && (
            <p className="text-xs text-neutral-500">
              Livraison {terminee.numeroLivraison} créée pour le {formaterDate(livraison.date_livraison_prevue)}.
            </p>
          )}
        </div>

        {/* Le choix du papier : il se fait ici, une fois la vente sûre, et la
            proposition d'office tient compte du réglage du poste. */}
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <p className="text-xs font-medium text-neutral-500 uppercase tracking-wide">À imprimer</p>
          <div className="mt-2 space-y-2">
            {SORTIES_PAPIER.map((choix) => (
              <button
                key={choix.id}
                type="button"
                onClick={() => imprimer(choix.id)}
                className={`w-full flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                  sortie === choix.id ? 'border-primary-500 bg-primary-50' : 'border-neutral-200 hover:border-primary-300'
                }`}
                data-testid={`imprimer-${choix.id.toLowerCase()}`}
              >
                <PrinterIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${sortie === choix.id ? 'text-primary-700' : 'text-neutral-400'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-neutral-900">{choix.libelle}</span>
                  <span className="block text-xs text-neutral-500">{choix.aide}</span>
                </span>
              </button>
            ))}
          </div>
        </div>

        {sortie === 'TICKET' ? (
          <TicketImprimable
            preparee={p}
            lignes={terminee.lignes}
            client={terminee.client}
            filiale={infosFiliale}
            caisse={ctx.caisseCode}
            vendeur={vendeur}
            date={terminee.date}
          />
        ) : (
          <LiasseVente
            sortie={sortie}
            preparee={p}
            lignes={terminee.lignes}
            client={terminee.client}
            avoir={terminee.avoir}
            date={terminee.date}
            vendeur={vendeur}
            depot={depot}
            livraison={livraison}
            numeroLivraison={terminee.numeroLivraison}
            numeroCourt={terminee.numeroCourt}
            numeroCourtLivraison={terminee.numeroCourtLivraison}
            filiale={infosFiliale}
          />
        )}
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
          <Bouton type="button" onClick={() => encaisser()} enCours={enCours} className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-semibold rounded-lg" disabled={enCours || !apercu.ok}>Valider la vente</Bouton>
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
            <ChampMontant
              valeur={montantPercu}
              onChange={setMontantPercu}
              autoFocus
              data-testid="montant-percu"
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
