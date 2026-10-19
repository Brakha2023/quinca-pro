import { useState } from 'react';
import { ArrowPathIcon, TrashIcon } from '@heroicons/react/24/outline';
import { LIBELLES_OPERATION, libelleTable } from '../../../core/sync';
import { EchecsEnvoiRepository } from '../../../infrastructure/powersync/repositories/EchecsEnvoiRepository';
import Modal from '../../components/ui/Modal';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { usePermissions } from '../../auth/usePermissions';
import { useNotifier } from '../../notifications/useNotifier';
import { useRepository } from '../../hooks/useRepository';
import { useEchecsEnvoi } from './useEchecsEnvoi';

const horodatage = (iso: string) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/**
 * Les écritures que le serveur a refusées définitivement : conservées sur le
 * poste avec leur motif. Un responsable réessaie (après correction côté
 * serveur) ou abandonne en connaissance de cause.
 */
export default function EchecsEnvoiModal({ onClose }: { onClose: () => void }) {
  const { echecs } = useEchecsEnvoi();
  const repository = useRepository(EchecsEnvoiRepository);
  const { peut } = usePermissions();
  const confirmer = useConfirmation();
  const notifier = useNotifier();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const peutDecider = peut('sync.decider');

  const reessayer = async (id: string) => {
    setEnCours(id);
    try {
      const r = await repository.reessayer(id);
      notifier(r.envoye ? 'succes' : 'erreur', r.envoye ? 'Écriture acceptée par le serveur.' : `Toujours refusée : ${r.motif}`);
    } catch (e) {
      notifier('erreur', e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setEnCours(null);
    }
  };

  const abandonner = async (id: string, resume: string) => {
    const ok = await confirmer({
      titre: 'Abandonner cette écriture ?',
      message: `${resume} ne sera jamais envoyée au serveur. La ligne reste sur ce poste, mais les autres postes et les états consolidés ne la verront pas.`,
      libelleConfirmer: 'Abandonner',
      danger: true,
    });
    if (!ok) return;
    await repository.abandonner(id);
    notifier('succes', 'Écriture abandonnée.');
  };

  return (
    <Modal
      titre="Écritures mises de côté"
      sousTitre="Refusées définitivement par le serveur. Rien n'est perdu : elles attendent ici une décision."
      largeur="max-w-4xl"
      onClose={onClose}
    >
      {echecs.length === 0 ? (
        <p className="text-center text-neutral-400 py-10" data-testid="aucun-echec">Aucune écriture mise de côté. Tout ce qui part est accepté.</p>
      ) : (
        <div className="space-y-3">
          {echecs.map((e) => (
            <div key={e.id} className="border border-orange-200 bg-orange-50/50 rounded-lg p-4" data-testid="echec-envoi">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-neutral-900">
                    {LIBELLES_OPERATION[e.operation]} · {libelleTable(e.table_cible)}
                    <span className="ml-2 font-mono text-xs text-neutral-500">{e.ligne_id.slice(0, 8)}</span>
                  </p>
                  <p className="text-sm text-neutral-700 mt-1" data-testid="echec-explication">{e.explication}</p>
                  <p className="text-xs text-neutral-500 mt-1">
                    {horodatage(e.date_echec)}
                    {e.utilisateur_nom && ` · ${e.utilisateur_prenom ?? ''} ${e.utilisateur_nom}`.trimEnd()}
                    {e.tentatives > 1 && ` · ${e.tentatives} tentatives`}
                    {e.code && ` · code serveur ${e.code}`}
                  </p>
                </div>
                {peutDecider && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => reessayer(e.id)}
                      disabled={enCours === e.id}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg border border-neutral-300 hover:bg-white disabled:opacity-50"
                      data-testid="reessayer-echec"
                    >
                      <ArrowPathIcon className={`w-4 h-4 ${enCours === e.id ? 'animate-spin' : ''}`} /> Réessayer
                    </button>
                    <button
                      type="button"
                      onClick={() => abandonner(e.id, `${LIBELLES_OPERATION[e.operation]} · ${libelleTable(e.table_cible)}`)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg text-red-700 border border-red-200 hover:bg-red-50"
                      data-testid="abandonner-echec"
                    >
                      <TrashIcon className="w-4 h-4" /> Abandonner
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setDetail(detail === e.id ? null : e.id)}
                className="text-xs text-primary-700 hover:underline mt-2"
              >
                {detail === e.id ? 'Masquer le détail' : 'Voir le message du serveur et les données'}
              </button>
              {detail === e.id && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs font-mono text-neutral-600 break-words" data-testid="echec-motif">{e.motif}</p>
                  <pre className="text-xs bg-white border border-neutral-200 rounded p-2 overflow-x-auto max-h-48">
                    {JSON.stringify(e.donnees, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ))}
          {!peutDecider && (
            <p className="text-sm text-neutral-500">Seul un gérant ou le directeur peut réessayer ou abandonner une écriture. Signalez-lui ce message.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
