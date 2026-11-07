import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDownTrayIcon, BuildingOffice2Icon, PaperAirplaneIcon, PrinterIcon } from '@heroicons/react/24/outline';
import {
  LIBELLES_STATUT_TRANSFERT_STOCK,
  SENS_TRANSFERT,
  STATUTS_FILTRE_TRANSFERT,
  construireBonTransfert,
  perimetreTransfertsStock,
  recapTransfertsStock,
  roleTransfertStock,
  transfertAnnulable,
  transfertFilialeStockSchema,
  transfertReceptionnable,
  type StatutTransfertStock,
  type TransfertStockVue,
} from '../../../core/stock';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import type { Depot } from '../../../core/articles';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { TransfertsStockRepository } from '../../../infrastructure/powersync/repositories/TransfertsStockRepository';
import FormField, { controleInlineClass, inputClass } from '../../components/ui/FormField';
import Modal from '../../components/ui/Modal';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import { useDepots } from '../articles/hooks';
import BonTransfertFilialeDocument from './BonTransfertFilialeDocument';
import { BasculeVue, CarteBon, SelectDepot, boutonPrimaire, boutonSecondaire, type InfosFiliale, type VueOnglet } from './EnteteBon';
import LignesBonEditor, { type LigneBonUI } from './LignesBonEditor';
import { useLignesTransfert, useTransfertsStock } from './hooks';

const STYLE_STATUT: Record<StatutTransfertStock, string> = {
  EN_TRANSIT: 'bg-orange-100 text-orange-800',
  RECU: 'bg-green-100 text-green-800',
  ANNULE: 'bg-neutral-200 text-neutral-600',
};

const dateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

interface Props {
  filialeId: string;
  filiale: InfosFiliale;
  /** Toutes les filiales actives : la destinataire s'y choisit. */
  filiales: Array<{ id: string; nom: string | null }>;
}

/**
 * Transfert de marchandise entre filiales.
 *
 * L'écran tient les deux bouts : on envoie depuis son dépôt, et on réceptionne
 * ce que les autres envoient. Entre les deux, la marchandise est sur la route
 * et n'est dans aucun dépôt — c'est le bon qui en répond, et il s'imprime.
 */
export default function TransfertFilialeStockPanel({ filialeId, filiale, filiales }: Props) {
  const repository = useRepository(TransfertsStockRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();
  const { depots } = useDepots(filialeId, { actifs: true });
  const autresFiliales = useMemo(() => filiales.filter((f) => f.id !== filialeId), [filiales, filialeId]);

  const [vue, setVue] = useState<VueOnglet>('saisie');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [sens, setSens] = useState<'TOUS' | 'ENVOIS' | 'RECEPTIONS'>('TOUS');
  const [filialeFiltre, setFilialeFiltre] = useState('');
  const [statut, setStatut] = useState<'' | StatutTransfertStock>('');
  const filtres = useMemo(
    () => ({ debut, fin, sens, filialeId: filialeFiltre || null, statut }),
    [debut, fin, sens, filialeFiltre, statut],
  );
  const { transferts } = useTransfertsStock(filialeId, filtres);
  const recap = recapTransfertsStock(transferts);
  const perimetre = perimetreTransfertsStock({ ...filtres, filialeNom: filiales.find((f) => f.id === filialeFiltre)?.nom ?? null });

  const [apercu, setApercu] = useState<TransfertStockVue | null>(null);
  const [reception, setReception] = useState<TransfertStockVue | null>(null);

  const annuler = async (t: TransfertStockVue) => {
    const ok = await confirmer({
      titre: `Annuler le transfert ${t.numero}`,
      message: `Les ${t.quantite_totale} article(s) rentreront au dépôt « ${t.depot_source_nom ?? 'de départ'} ». À ne faire que si le camion n'est pas parti.`,
      libelleConfirmer: 'Annuler le transfert',
      danger: true,
    });
    if (!ok) return;
    try {
      await repository.annuler({ filialeId, utilisateurId: utilisateur?.id ?? null }, t.id, 'Marchandise non partie');
      notifier('succes', `Transfert ${t.numero} annulé, la marchandise est rentrée au dépôt.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Annulation impossible.');
    }
  };

  const exporter = async () => {
    try {
      const chemin = await exporterExcel('transferts-filiales', [{
        nom: 'Transferts',
        lignes: transferts.map((t) => ({
          Date: dateHeure(t.date_envoi),
          'Bon n°': t.numero,
          Sens: roleTransfertStock(t, filialeId) === 'EXPEDITEUR' ? 'Envoi' : 'Réception',
          Expéditeur: t.filiale_source_nom ?? '',
          'Dépôt départ': t.depot_source_nom ?? '',
          Destinataire: t.filiale_destination_nom ?? '',
          "Dépôt d'arrivée": t.depot_destination_nom ?? '',
          Articles: t.nombre_lignes,
          Quantité: t.quantite_totale,
          Valeur: t.valeur_totale,
          Statut: LIBELLES_STATUT_TRANSFERT_STOCK[t.statut],
          Transporteur: t.transporteur ?? '',
          Motif: t.motif ?? '',
          'Op. saisie': t.utilisateur_envoi ?? '',
          Réception: t.date_reception ? dateHeure(t.date_reception) : '',
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const bascule = <BasculeVue vue={vue} onChange={setVue} />;

  if (vue === 'saisie') {
    // Le garde-fou ne vaut que pour l'envoi : l'historique reste consultable.
    const manque = autresFiliales.length === 0
      ? 'Aucune autre filiale active : le transfert entre filiales demande au moins deux filiales.'
      : depots.length === 0 ? 'Aucun dépôt actif dans cette filiale.' : null;
    return (
      <>
        {manque ? (
          <CarteBon titre="Envoyer de la marchandise à une autre filiale" description={manque} bascule={bascule}>
            <p className="text-sm text-neutral-500">L'historique reste consultable : les bons déjà échangés y figurent, et c'est de là qu'une réception se fait.</p>
          </CarteBon>
        ) : (
          <Formulaire filialeId={filialeId} depots={depots} filiales={autresFiliales} bascule={bascule} />
        )}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">Transferts entre filiales</h2>
          <p className="text-sm text-neutral-500">Les bons échangés avec les autres filiales, dans les deux sens. C'est ici qu'une marchandise en transit se réceptionne.</p>
        </div>
        {bascule}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3 print:hidden">
          <FormField label="Du"><input type="date" value={debut} onChange={(e) => setDebut(e.target.value)} className={inputClass} data-testid="transfert-debut" /></FormField>
          <FormField label="Au"><input type="date" value={fin} onChange={(e) => setFin(e.target.value)} className={inputClass} data-testid="transfert-fin" /></FormField>
          <select value={sens} onChange={(e) => setSens(e.target.value as typeof sens)} className={controleInlineClass} data-testid="filtre-sens-transfert">
            {SENS_TRANSFERT.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={filialeFiltre} onChange={(e) => setFilialeFiltre(e.target.value)} className={controleInlineClass} data-testid="filtre-filiale-transfert">
            <option value="">Toutes les filiales</option>
            {autresFiliales.map((f) => <option key={f.id} value={f.id}>{f.nom ?? f.id}</option>)}
          </select>
          <select value={statut} onChange={(e) => setStatut(e.target.value as typeof statut)} className={controleInlineClass} data-testid="filtre-statut-transfert">
            {STATUTS_FILTRE_TRANSFERT.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <span className="text-sm text-neutral-600" data-testid="compteur-transferts">
            <strong>{recap.nombre}</strong> bon(s) · {recap.en_transit} en transit · valeur <strong className="font-mono">{formaterFcfa(recap.valeur)}</strong>
          </span>
          <Bouton onClick={exporter} icone={ArrowDownTrayIcon} className="ml-auto flex items-center gap-2 px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg text-sm" data-testid="exporter-transferts">Exporter Excel</Bouton>
        </div>

        <Carte titre="Historique des transferts inter-filiales" icone={BuildingOffice2Icon} sous={perimetre} sousEntier nu>
          <div className="overflow-x-auto">
            <table className="tableau">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600">
                <tr>
                  <th className="px-3 py-2 text-left">Envoi</th>
                  <th className="px-3 py-2 text-left">Bon n°</th>
                  <th className="px-3 py-2 text-left">Sens</th>
                  <th className="px-3 py-2 text-left">Filiale</th>
                  <th className="px-3 py-2 text-left">Dépôts</th>
                  <th className="px-3 py-2 text-right">Art.</th>
                  <th className="px-3 py-2 text-right">Qté</th>
                  <th className="px-3 py-2 text-right">Valeur</th>
                  <th className="px-3 py-2 text-center">Statut</th>
                  <th className="px-3 py-2 text-left">Op. saisie</th>
                  <th className="px-3 py-2 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {transferts.map((t) => {
                  const role = roleTransfertStock(t, filialeId);
                  return (
                    <tr key={t.id} className="hover:bg-neutral-50" data-testid={`bon-transfert-${t.numero}`}>
                      <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{dateHeure(t.date_envoi)}</td>
                      <td className="px-3 py-2 text-sm font-mono text-neutral-600">{t.numero}</td>
                      <td className="px-3 py-2 text-sm">{role === 'EXPEDITEUR' ? 'Envoi' : 'Réception'}</td>
                      <td className="px-3 py-2 text-sm">{role === 'EXPEDITEUR' ? t.filiale_destination_nom : t.filiale_source_nom}</td>
                      <td className="px-3 py-2 text-sm text-neutral-600">{t.depot_source_nom ?? '—'} → {t.depot_destination_nom ?? '—'}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{t.nombre_lignes}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{t.quantite_totale.toLocaleString('fr-FR', { maximumFractionDigits: 2 })}</td>
                      <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(t.valeur_totale)}</td>
                      <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STYLE_STATUT[t.statut]}`}>{LIBELLES_STATUT_TRANSFERT_STOCK[t.statut]}</span></td>
                      <td className="px-3 py-2 text-sm text-neutral-600">{t.utilisateur_envoi ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <Bouton onClick={() => setApercu(t)} icone={PrinterIcon} className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100" title="Imprimer le bon" data-testid={`imprimer-transfert-${t.numero}`}></Bouton>
                          {transfertReceptionnable(t, filialeId) && (
                            <button type="button" onClick={() => setReception(t)} className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium" data-testid="receptionner-transfert">Réceptionner</button>
                          )}
                          {transfertAnnulable(t, filialeId) && (
                            <button type="button" onClick={() => annuler(t)} className="px-3 py-1 rounded-lg text-red-600 hover:bg-red-50 text-xs font-medium">Annuler</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {transferts.length === 0 && <div className="text-center py-8 text-neutral-400 text-sm">Aucun transfert dans ce périmètre.</div>}
        </Carte>
      </div>

      {apercu && <BonImprimable transfert={apercu} filiale={filiale} onClose={() => setApercu(null)} />}
      {reception && (
        <ModaleReception
          transfert={reception}
          depots={depots}
          onClose={() => setReception(null)}
          onReceptionner={async (depotId) => {
            try {
              const resultat = await repository.recevoir({ filialeId, utilisateurId: utilisateur?.id ?? null }, reception.id, depotId);
              notifier('succes', resultat.articlesCrees.length
                ? `Transfert ${resultat.numero} reçu. ${resultat.articlesCrees.length} article(s) créé(s) dans votre catalogue (${resultat.articlesCrees.join(', ')}) : vérifiez leur prix de vente.`
                : `Transfert ${resultat.numero} reçu, marchandise entrée en stock.`);
              setReception(null);
            } catch (error) {
              notifier('erreur', error instanceof Error ? error.message : 'Réception impossible.');
            }
          }}
        />
      )}
    </div>
  );
}

/** Le bon se reconstruit de ses lignes au moment de l'aperçu. */
function BonImprimable({ transfert, filiale, onClose }: { transfert: TransfertStockVue; filiale: InfosFiliale; onClose: () => void }) {
  const lignes = useLignesTransfert(transfert.id);
  return <BonTransfertFilialeDocument bon={construireBonTransfert(transfert, lignes)} filiale={filiale} onClose={onClose} />;
}

function Formulaire({ filialeId, depots, filiales, bascule }: { filialeId: string; depots: Depot[]; filiales: Array<{ id: string; nom: string | null }>; bascule: ReactNode }) {
  const repository = useRepository(TransfertsStockRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();

  const [destinationId, setDestinationId] = useState('');
  const [depotId, setDepotId] = useState('');
  const [transporteur, setTransporteur] = useState('');
  const [motif, setMotif] = useState('');
  const [lignes, setLignes] = useState<LigneBonUI[]>([]);
  const [enCours, setEnCours] = useState(false);
  const depotEffectif = depotId || depots[0]?.id || '';
  const destinationEffective = destinationId || filiales[0]?.id || '';

  const reinitialiser = () => { setLignes([]); setTransporteur(''); setMotif(''); };

  const envoyer = async () => {
    const parsed = transfertFilialeStockSchema.safeParse({
      filiale_destination_id: destinationEffective,
      depot_source_id: depotEffectif,
      transporteur, motif,
      lignes: lignes.map((l) => ({ article_id: l.article.id, quantite: l.quantite })),
    });
    if (!parsed.success) { notifier('erreur', parsed.error.issues[0].message); return; }

    const destination = filiales.find((f) => f.id === destinationEffective);
    const ok = await confirmer({
      titre: 'Envoyer la marchandise',
      message: `${parsed.data.lignes.length} article(s) vont sortir de votre dépôt dès maintenant. ${destination?.nom ?? 'La filiale destinataire'} devra réceptionner le bon pour que la marchandise entre dans son stock.`,
      libelleConfirmer: 'Envoyer',
    });
    if (!ok) return;

    setEnCours(true);
    try {
      const numero = await repository.envoyer({ filialeId, utilisateurId: utilisateur?.id ?? null }, parsed.data);
      notifier('succes', `Transfert ${numero} envoyé vers ${destination?.nom ?? ''} (${parsed.data.lignes.length} ligne(s)). Imprimez le bon pour le chauffeur.`);
      reinitialiser();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Envoi impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <CarteBon
      titre="Envoyer de la marchandise à une autre filiale"
      description="La marchandise sort du dépôt de départ tout de suite et le bon reste « en transit » : la filiale destinataire la fait entrer dans son stock à l'arrivée."
      bascule={bascule}
      actions={
        <>
          <button type="button" onClick={reinitialiser} className={boutonSecondaire} disabled={lignes.length === 0}>Vider</button>
          <button type="button" onClick={envoyer} className={`${boutonPrimaire} flex items-center gap-2`} disabled={enCours || lignes.length === 0} data-testid="envoyer-transfert">
            <PaperAirplaneIcon className="w-4 h-4" /> Envoyer la marchandise
          </button>
        </>
      }
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SelectDepot label="Dépôt de départ" depots={depots} value={depotEffectif} onChange={setDepotId} />
        <FormField label="Filiale destinataire" obligatoire>
          <select value={destinationEffective} onChange={(e) => setDestinationId(e.target.value)} className={inputClass} data-testid="transfert-stock-destination">
            {filiales.map((f) => <option key={f.id} value={f.id}>{f.nom ?? f.id}</option>)}
          </select>
        </FormField>
        <FormField label="Transporteur">
          <input value={transporteur} onChange={(e) => setTransporteur(e.target.value)} placeholder="Chauffeur, véhicule…" className={inputClass} maxLength={120} />
        </FormField>
        <FormField label="Motif">
          <input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Appro. filiale, rééquilibrage…" className={inputClass} maxLength={200} />
        </FormField>
      </div>
      <LignesBonEditor filialeId={filialeId} depotId={depotEffectif} lignes={lignes} onChange={setLignes} controlerDisponible />
    </CarteBon>
  );
}

function ModaleReception({ transfert, depots, onClose, onReceptionner }: {
  transfert: TransfertStockVue;
  depots: Depot[];
  onClose: () => void;
  onReceptionner: (depotId: string) => Promise<void>;
}) {
  const [depotId, setDepotId] = useState(depots[0]?.id ?? '');
  const [enCours, setEnCours] = useState(false);
  const lignes = useLignesTransfert(transfert.id);

  return (
    <Modal
      titre={`Réceptionner le transfert ${transfert.numero}`}
      sousTitre={`${transfert.nombre_lignes} article(s) en provenance de ${transfert.filiale_source_nom ?? ''}`}
      largeur="max-w-2xl"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Fermer</button>
          <Bouton type="button" onClick={async () => { setEnCours(true); await onReceptionner(depotId); setEnCours(false); }} enCours={enCours} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" disabled={enCours || !depotId} data-testid="confirmer-reception">Faire entrer en stock</Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <SelectDepot label="Dépôt qui reçoit la marchandise" depots={depots} value={depotId} onChange={setDepotId} />
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
          <table className="tableau">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-600"><tr><th className="px-3 py-2 text-left">Article</th><th className="px-3 py-2 text-right">Quantité</th><th className="px-3 py-2 text-right">Coût unitaire</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {lignes.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 text-sm"><span className="font-mono text-primary-700 mr-2">{l.code}</span>{l.designation}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono">{l.quantite} {l.unite}</td>
                  <td className="px-3 py-2 text-sm text-right font-mono text-neutral-600">{formaterFcfa(l.cout_unitaire)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-neutral-500">
          La marchandise entrera au coût du dépôt de départ. Un article que votre catalogue ne connaît pas encore sera créé
          avec le prix de vente de l'expéditeur, à vérifier ensuite dans le catalogue.
        </p>
      </div>
    </Modal>
  );
}
