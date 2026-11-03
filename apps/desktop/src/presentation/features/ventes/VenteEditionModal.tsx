import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlassIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { MODES_PAIEMENT, type ModePaiement } from '@quinca/shared-types';
import {
  LIBELLES_MODE_PAIEMENT, ajouterAuPanier, calculerTotaux, lignesPanierDepuisVente,
  preparerVente, remiseDepuisVente, type LignePanier,
} from '../../../core/ventes';
import Bouton from '../../components/ui/Bouton';
import type { Client } from '../../../core/clients';
import { VentesRepository, type VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';
import ChampMontant from '../../components/ui/ChampMontant';
import Modal from '../../components/ui/Modal';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useArticles } from '../articles/hooks';
import { useClients } from '../clients/hooks';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useLignesVente } from './hooks';

interface Props {
  vente: VenteVueRow;
  filialeId: string;
  onClose: () => void;
}

/**
 * Correction d'un ticket en attente : quantités, articles, remise, client,
 * règlement. Le numéro, la date et la caisse ne bougent pas — c'est la même
 * vente, corrigée, pas une nouvelle.
 *
 * L'unité n'est pas affichée : la ligne de vente ne la garde pas, et la
 * reprendre sur l'article pour l'écrire ici ne servirait qu'à décorer.
 */
export default function VenteEditionModal({ vente, filialeId, onClose }: Props) {
  const repository = useRepository(VentesRepository);
  const notifier = useNotifier();
  const { utilisateur } = useCurrentUtilisateur();
  const lignesEnregistrees = useLignesVente(vente.id);
  const { clients } = useClients(filialeId);

  const [lignes, setLignes] = useState<LignePanier[]>([]);
  const [remise, setRemise] = useState(0);
  const [clientId, setClientId] = useState(vente.client_id ?? '');
  const [mode, setMode] = useState<ModePaiement>((vente.mode_paiement ?? 'ESPECES') as ModePaiement);
  const [montantPercu, setMontantPercu] = useState(vente.montant_percu ?? 0);
  const [recherche, setRecherche] = useState('');
  const [enCours, setEnCours] = useState(false);
  /** Le ticket n'est repris qu'une fois : la requête vivante changera sous nous. */
  const repris = useRef(false);

  const { articles } = useArticles(filialeId, { recherche });

  useEffect(() => {
    if (repris.current || lignesEnregistrees.length === 0) return;
    repris.current = true;
    const panier = lignesPanierDepuisVente(lignesEnregistrees, () => undefined);
    setLignes(panier);
    setRemise(remiseDepuisVente(panier, vente.total_ttc ?? 0));
  }, [lignesEnregistrees, vente.total_ttc]);

  const client = useMemo(() => clients.find((c) => c.id === clientId) ?? null, [clients, clientId]);
  const totaux = useMemo(() => calculerTotaux(lignes, remise), [lignes, remise]);

  /** Mêmes règles de caisse qu'à l'encaissement : on les montre avant d'écrire. */
  const apercu = useMemo(() => {
    try {
      const corrige: Client | null = client && client.id === vente.client_id
        ? { ...client, solde_actuel: client.solde_actuel - (vente.reste_a_payer ?? 0) }
        : client;
      return {
        ok: true as const,
        v: preparerVente(
          { lignes, remise, client: corrige, paiement: { mode_paiement: mode, montant_percu: montantPercu }, livraison: null, notes: '' },
          { caisse: 'C', code: 'EDIT' },
        ),
      };
    } catch (e) {
      return { ok: false as const, message: e instanceof Error ? e.message : 'Ticket invalide' };
    }
  }, [lignes, remise, client, mode, montantPercu, vente.client_id, vente.reste_a_payer]);

  const changerQuantite = (articleId: string, quantite: number) =>
    setLignes((l) => (quantite <= 0 ? l.filter((x) => x.article_id !== articleId) : l.map((x) => (x.article_id === articleId ? { ...x, quantite } : x))));

  const ajouter = (article: { id: string; code: string; designation: string; unite: string; prix_vente: number; tva: number }) => {
    setLignes((l) => ajouterAuPanier(l, {
      article_id: article.id, code: article.code, designation: article.designation, unite: article.unite,
      prix_unitaire_ttc: article.prix_vente, tva_percent: article.tva, quantite: 1, remise_percent: 0,
    }));
    setRecherche('');
  };

  const enregistrer = async () => {
    setEnCours(true);
    try {
      await repository.modifier(
        { filialeId, utilisateurId: utilisateur?.id ?? null },
        vente.id,
        { lignes, remise, client, paiement: { mode_paiement: mode, montant_percu: montantPercu }, livraison: null, notes: vente.notes ?? '' },
      );
      notifier('succes', `Ticket ${vente.numero} corrigé.`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Correction impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      titre={`Corriger le ticket ${vente.numero}`}
      sousTitre="Le numéro, la date et la caisse ne changent pas. Le stock et la caisse suivent la correction."
      largeur="max-w-3xl"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <Bouton type="button" onClick={enregistrer} enCours={enCours} className="px-6 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-semibold rounded-lg" disabled={enCours || !apercu.ok} data-testid="enregistrer-correction">Enregistrer la correction</Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <table className="tableau text-sm">
          <thead className="bg-neutral-50 text-xs uppercase text-neutral-600">
            <tr>
              <th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">P.U. TTC</th>
              <th className="px-3 py-2 text-center">Qté</th><th className="px-3 py-2 text-right">Total</th><th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100" data-testid="lignes-correction">
            {lignes.map((l) => (
              <tr key={l.article_id}>
                <td className="px-3 py-2"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}</td>
                <td className="px-3 py-2 text-right font-mono text-neutral-600">{formaterFcfa(l.prix_unitaire_ttc)}</td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={l.quantite}
                    onChange={(e) => changerQuantite(l.article_id, Number(e.target.value))}
                    className={`${inputClass} w-24 text-center font-mono`}
                    data-testid={`quantite-${l.code}`}
                  />
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold">{formaterFcfa(l.prix_unitaire_ttc * l.quantite)}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" onClick={() => changerQuantite(l.article_id, 0)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Retirer la ligne" data-testid={`retirer-${l.code}`}>
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {lignes.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-neutral-400">Ticket vide : ajoutez au moins un article.</td></tr>
            )}
          </tbody>
        </table>

        <div className="relative">
          <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Ajouter un article : code ou désignation…"
            className={`${inputClass} pl-10`}
            data-testid="ajouter-article"
          />
          {recherche.trim().length > 0 && (
            <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
              {articles.slice(0, 20).map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => ajouter(a)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50">
                    <PlusIcon className="h-4 w-4 text-primary-600" />
                    <span className="font-mono text-primary-700">{a.code}</span>
                    <span className="flex-1 truncate">{a.designation}</span>
                    <span className="font-mono text-neutral-600">{formaterFcfa(a.prix_vente)}</span>
                  </button>
                </li>
              ))}
              {articles.length === 0 && <li className="px-3 py-2 text-sm text-neutral-400">Aucun article.</li>}
            </ul>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-xs font-medium text-neutral-700">
            Client
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} className={`${controleInlineClass} mt-1 w-full`} data-testid="client-correction">
              <option value="">Client comptoir</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.raison_sociale}</option>)}
            </select>
          </label>
          <label className="block text-xs font-medium text-neutral-700">
            Remise sur la vente (F)
            <ChampMontant valeur={remise} onChange={setRemise} zeroVide className={`${inputClass} mt-1 text-right font-mono`} data-testid="remise-correction" />
          </label>
        </div>

        <div>
          <p className="text-xs font-medium text-neutral-700">Règlement</p>
          <div className="mt-1 grid grid-cols-2 gap-2 md:grid-cols-4">
            {MODES_PAIEMENT.filter((m) => m !== 'CREDIT' || (client && client.plafond_credit > 0)).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); if (m !== 'ESPECES') setMontantPercu(totaux.total_ttc); }}
                className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${mode === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 text-neutral-700 hover:border-primary-300'}`}
              >
                {LIBELLES_MODE_PAIEMENT[m]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {mode !== 'CREDIT' && (
            <label className="block text-xs font-medium text-neutral-700">
              {mode === 'ESPECES' ? 'Montant remis par le client' : 'Montant perçu'}
              <ChampMontant valeur={montantPercu} onChange={setMontantPercu} className={`${inputClass} mt-1 text-right font-mono`} data-testid="percu-correction" />
            </label>
          )}
          <div className={`rounded-lg p-3 text-sm ${apercu.ok ? 'border border-neutral-200 bg-neutral-50' : 'border border-red-200 bg-red-50 text-red-700'}`} data-testid="apercu-correction">
            {apercu.ok ? (
              <div className="space-y-1">
                <div className="flex justify-between font-semibold"><span>Total TTC</span><span className="font-mono text-primary-700">{formaterFcfa(totaux.total_ttc)}</span></div>
                {totaux.total_remise > 0 && <div className="flex justify-between text-orange-600"><span>Remise</span><span className="font-mono">−{formaterFcfa(totaux.total_remise)}</span></div>}
                {apercu.v.monnaie > 0 && <div className="flex justify-between text-green-700"><span>Monnaie à rendre</span><span className="font-mono">{formaterFcfa(apercu.v.monnaie)}</span></div>}
                {apercu.v.reste_a_payer > 0 && <div className="flex justify-between text-orange-700"><span>Reste dû (créance)</span><span className="font-mono">{formaterFcfa(apercu.v.reste_a_payer)}</span></div>}
              </div>
            ) : (
              apercu.message
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
