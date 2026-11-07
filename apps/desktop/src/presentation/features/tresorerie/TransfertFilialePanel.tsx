import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { BuildingOffice2Icon, PaperAirplaneIcon, PrinterIcon } from '@heroicons/react/24/outline';
import {
  LIBELLES_STATUT_TRANSFERT, construireBordereauFonds, roleFiliale, transfertFilialeSchema,
  type Caisse, type TransfertFilialeForm, type TransfertFilialeFormInput,
} from '../../../core/tresorerie';
import Bouton from '../../components/ui/Bouton';
import Carte from '../../components/ui/Carte';
import { TresorerieRepository } from '../../../infrastructure/powersync/repositories/TresorerieRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useCurrentUtilisateur } from '../../auth/useCurrentUtilisateur';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { formaterFcfa } from '../../hooks/useFormatage';
import { useNotifier } from '../../notifications/useNotifier';
import AucuneCaisse from './AucuneCaisse';
import BordereauFondsDocument from './BordereauFondsDocument';
import SelectCaisse from './SelectCaisse';
import { enteteBordereau, useCaissesToutes, useTransfertsFiliales, type TransfertFilialeVue } from './hooks';

const formaterDateHeure = (iso: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');

const STYLE_STATUT: Record<string, string> = { EN_TRANSIT: 'bg-orange-100 text-orange-800', RECU: 'bg-green-100 text-green-800', ANNULE: 'bg-neutral-200 text-neutral-600' };

interface Props {
  filialeId: string;
  /** Entête du bordereau imprimé. */
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  /** Les autres filiales où l'on peut envoyer des fonds. */
  filiales: Array<{ id: string; nom: string | null }>;
}

/**
 * Transfert d'espèces entre filiales. L'argent voyage : la filiale source
 * sort les fonds tout de suite (le transfert part « en transit »), la filiale
 * destinataire les encaisse à l'arrivée dans la caisse de son choix.
 *
 * Chaque ligne s'imprime en **bordereau** — la pièce qui part avec l'argent,
 * signée du gérant ou du directeur aux deux bouts. Elle se réimprime à tout
 * moment : un bordereau se perd en route, et un transfert annulé se classe.
 */
export default function TransfertFilialePanel({ filialeId, filiale, filiales }: Props) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();
  const caisses = useCaissesToutes(filialeId).filter((c) => c.est_active);
  const { transferts } = useTransfertsFiliales(filialeId);
  const [reception, setReception] = useState<TransfertFilialeVue | null>(null);
  const [apercu, setApercu] = useState<TransfertFilialeVue | null>(null);
  const autresFiliales = filiales.filter((f) => f.id !== filialeId);

  const annuler = async (t: TransfertFilialeVue) => {
    const ok = await confirmer({
      titre: `Annuler le transfert ${t.numero ?? ''}`,
      message: `Les ${formaterFcfa(t.montant ?? 0)} seront recrédités sur ${t.caisse_source_nom ?? 'la caisse source'}. À ne faire que si les fonds n'ont pas quitté la filiale.`,
      libelleConfirmer: 'Annuler le transfert',
      danger: true,
    });
    if (!ok) return;
    try { await repository.annulerTransfert({ filialeId, utilisateurId: utilisateur?.id ?? null }, t.id, 'Fonds non partis'); notifier('succes', `Transfert ${t.numero ?? ''} annulé.`); }
    catch (error) { notifier('erreur', error instanceof Error ? error.message : 'Annulation impossible.'); }
  };

  return (
    <div className="space-y-5">
      {autresFiliales.length === 0 ? (
        <AucuneCaisse message="Aucune autre filiale à desservir : le transfert inter-filiale demande au moins deux filiales actives." />
      ) : caisses.length === 0 ? (
        <AucuneCaisse />
      ) : (
        <Formulaire key={caisses[0]!.id} filialeId={filialeId} caisses={caisses} filiales={autresFiliales} />
      )}

      <Carte titre="Transferts envoyés et reçus" icone={BuildingOffice2Icon} sous={`Vus de ${filiale.nom} : ce qui part et ce qui arrive`} nu>
        <div className="overflow-x-auto">
          {/* Le titre reste en place : seul le tableau glisse. */}
          <table className="tableau">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs uppercase text-neutral-600"><tr>
              <th className="px-3 py-2 text-left">Envoi</th><th className="px-3 py-2 text-left">Pièce</th><th className="px-3 py-2 text-left">Sens</th><th className="px-3 py-2 text-left">Filiale</th><th className="px-3 py-2 text-left">Caisse source</th><th className="px-3 py-2 text-left">Motif</th><th className="px-3 py-2 text-right">Montant</th><th className="px-3 py-2 text-center">Statut</th><th className="px-3 py-2 text-center">Réception</th><th className="px-3 py-2 text-center">Bordereau</th>
            </tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {transferts.map((t) => {
                const role = roleFiliale({ filiale_source_id: t.filiale_source_id ?? '', filiale_destination_id: t.filiale_destination_id ?? '' }, filialeId);
                const enTransit = t.statut === 'EN_TRANSIT';
                return (
                  <tr key={t.id} className="hover:bg-neutral-50" data-testid={`transfert-${t.numero}`}>
                    <td className="px-3 py-2 text-sm text-neutral-600 whitespace-nowrap">{formaterDateHeure(t.date_envoi)}</td>
                    <td className="px-3 py-2 text-sm font-mono text-neutral-600">{t.numero}</td>
                    <td className="px-3 py-2 text-sm">{role === 'EXPEDITEUR' ? 'Envoi' : 'Réception'}</td>
                    <td className="px-3 py-2 text-sm">{role === 'EXPEDITEUR' ? t.filiale_destination_nom : t.filiale_source_nom}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600">{t.caisse_source_nom ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-neutral-600 max-w-xs truncate" title={t.motif ?? ''}>{t.motif ?? '—'}</td>
                    <td className="px-3 py-2 text-sm text-right font-mono">{formaterFcfa(t.montant ?? 0)}</td>
                    <td className="px-3 py-2 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STYLE_STATUT[t.statut ?? ''] ?? ''}`}>{LIBELLES_STATUT_TRANSFERT[(t.statut ?? 'EN_TRANSIT') as keyof typeof LIBELLES_STATUT_TRANSFERT]}</span></td>
                    <td className="px-3 py-2 text-center text-sm">
                      {enTransit && role === 'DESTINATAIRE' && <button type="button" onClick={() => setReception(t)} disabled={caisses.length === 0} className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white text-xs font-medium" data-testid="encaisser-transfert">Encaisser</button>}
                      {enTransit && role === 'EXPEDITEUR' && <button type="button" onClick={() => annuler(t)} className="px-3 py-1 rounded-lg text-red-600 hover:bg-red-50 text-xs font-medium">Annuler</button>}
                      {!enTransit && <span className="text-neutral-500">{formaterDateHeure(t.date_reception)}</span>}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {/* La pièce se réimprime à tout moment : un bordereau se perd en
                          route, et un transfert annulé se classe lui aussi. */}
                      <Bouton onClick={() => setApercu(t)} icone={PrinterIcon} className="p-1.5 rounded-lg text-neutral-600 hover:bg-neutral-100" title="Imprimer le bordereau" data-testid={`imprimer-bordereau-${t.numero}`}></Bouton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {transferts.length === 0 && <div className="text-center py-8 text-neutral-400 text-sm">Aucun transfert entre filiales.</div>}
      </Carte>

      {apercu && (
        <BordereauFondsDocument
          bordereau={construireBordereauFonds(enteteBordereau(apercu))}
          filiale={filiale}
          onClose={() => setApercu(null)}
        />
      )}

      {reception && (
        <ModaleReception
          transfert={reception}
          caisses={caisses}
          onClose={() => setReception(null)}
          onEncaisser={async (caisseId) => {
            try {
              await repository.recevoirTransfert({ filialeId, utilisateurId: utilisateur?.id ?? null }, reception.id, caisseId);
              notifier('succes', `Transfert ${reception.numero ?? ''} encaissé.`);
              setReception(null);
            } catch (error) {
              notifier('erreur', error instanceof Error ? error.message : 'Encaissement impossible.');
            }
          }}
        />
      )}
    </div>
  );
}

function Formulaire({ filialeId, caisses, filiales }: { filialeId: string; caisses: Caisse[]; filiales: Array<{ id: string; nom: string | null }> }) {
  const repository = useRepository(TresorerieRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();
  const { utilisateur } = useCurrentUtilisateur();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<TransfertFilialeFormInput, unknown, TransfertFilialeForm>({
    resolver: zodResolver(transfertFilialeSchema),
    defaultValues: { caisse_source_id: caisses[0]!.id, filiale_destination_id: filiales[0]?.id ?? '', montant: 0, motif: '' },
  });
  const source = caisses.find((c) => c.id === watch('caisse_source_id'));

  const onSubmit = async (form: TransfertFilialeForm) => {
    const destination = filiales.find((f) => f.id === form.filiale_destination_id);
    const ok = await confirmer({
      titre: 'Envoyer les fonds',
      message: `${formaterFcfa(form.montant)} vont sortir de ${source?.nom ?? 'la caisse'} dès maintenant. ${destination?.nom ?? 'La filiale destinataire'} devra confirmer la réception pour que les fonds entrent dans sa caisse.`,
      libelleConfirmer: 'Envoyer',
    });
    if (!ok) return;
    try {
      const numero = await repository.envoyerVersFiliale({ filialeId, utilisateurId: utilisateur?.id ?? null }, form);
      notifier('succes', `Transfert ${numero} de ${formaterFcfa(form.montant)} envoyé vers ${destination?.nom ?? ''}.`);
      reset({ caisse_source_id: form.caisse_source_id, filiale_destination_id: form.filiale_destination_id, montant: 0, motif: '' });
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Transfert impossible.');
    }
  };

  return (
    <Carte titre="Envoi de fonds vers une filiale" icone={PaperAirplaneIcon} sous="Les fonds sortent de la caisse dès l'envoi et restent en transit jusqu'à l'encaissement">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <SelectCaisse caisses={caisses} value={watch('caisse_source_id')} onChange={(id) => setValue('caisse_source_id', id)} label="Caisse de départ" erreur={errors.caisse_source_id?.message} testId="transfert-filiale-caisse" />
          <FormField label="Filiale destinataire" obligatoire erreur={errors.filiale_destination_id?.message}>
            <select {...register('filiale_destination_id')} className={`${inputClass} ${errors.filiale_destination_id ? inputErrorClass : ''}`} data-testid="transfert-filiale-destination">
              {filiales.map((f) => <option key={f.id} value={f.id}>{f.nom ?? f.id}</option>)}
            </select>
          </FormField>
          <FormField label="Montant" obligatoire erreur={errors.montant?.message}><input type="number" step="1" min="0" {...register('montant')} className={`${inputClass} ${errors.montant ? inputErrorClass : ''} text-right font-mono text-lg`} data-testid="transfert-filiale-montant" /></FormField>
        </div>
        <FormField label="Motif" erreur={errors.motif?.message}><input {...register('motif')} className={inputClass} placeholder="Appro. caisse, remontée de recettes…" /></FormField>
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-600">Solde de {source?.nom ?? '—'} : <strong className={`font-mono ${(source?.solde_actuel ?? 0) < 0 ? 'text-red-600' : ''}`}>{formaterFcfa(source?.solde_actuel ?? 0)}</strong></p>
          <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg"><PaperAirplaneIcon className="w-5 h-5" /> Envoyer les fonds</button>
        </div>
      </form>
    </Carte>
  );
}

function ModaleReception({ transfert, caisses, onClose, onEncaisser }: { transfert: TransfertFilialeVue; caisses: Caisse[]; onClose: () => void; onEncaisser: (caisseId: string) => Promise<void> }) {
  const [caisseId, setCaisseId] = useState(caisses[0]?.id ?? '');
  const [enCours, setEnCours] = useState(false);
  return (
    <Modal
      titre={`Encaisser le transfert ${transfert.numero ?? ''}`}
      sousTitre={`${formaterFcfa(transfert.montant ?? 0)} en provenance de ${transfert.filiale_source_nom ?? ''}`}
      largeur="max-w-lg"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <Bouton type="button" onClick={async () => { setEnCours(true); await onEncaisser(caisseId); setEnCours(false); }} enCours={enCours} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" disabled={enCours || !caisseId} data-testid="confirmer-encaissement">Encaisser</Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-neutral-600"><BuildingOffice2Icon className="w-5 h-5 text-neutral-400" /> Envoyé le {formaterDateHeure(transfert.date_envoi)}{transfert.motif ? ` — ${transfert.motif}` : ''}</p>
        <SelectCaisse caisses={caisses} value={caisseId} onChange={setCaisseId} label="Caisse qui reçoit les fonds" testId="reception-caisse" />
      </div>
    </Modal>
  );
}
