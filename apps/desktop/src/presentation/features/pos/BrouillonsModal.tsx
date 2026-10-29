import { ArrowUturnLeftIcon, TrashIcon, UsersIcon } from '@heroicons/react/24/outline';
import type { Brouillon } from '../../../core/ventes';
import { codePoste } from '../../../infrastructure/desktop/identitePoste';
import { formaterFcfa } from '../../hooks/useFormatage';
import Modal from '../../components/ui/Modal';
import { useConfirmation } from '../../confirmation/useConfirmation';

interface Props {
  brouillons: Brouillon[];
  /** Le ticket en cours n'est pas vide : le reprendre écrase quelque chose. */
  ticketEnCours: boolean;
  onReprendre: (brouillon: Brouillon) => void;
  onSupprimer: (brouillon: Brouillon) => void;
  onClose: () => void;
}

const heure = (iso: string) => (iso
  ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  : '—');

/** Les ventes mises de côté dans la filiale : on en reprend une, ou on la jette. */
export default function BrouillonsModal({ brouillons, ticketEnCours, onReprendre, onSupprimer, onClose }: Props) {
  const confirmer = useConfirmation();
  const moi = codePoste();

  const reprendre = async (b: Brouillon) => {
    if (ticketEnCours && !(await confirmer({
      titre: 'Reprendre ce brouillon',
      message: 'Le ticket en cours sera remplacé. Mettez-le d’abord en brouillon si vous voulez le garder.',
      libelleConfirmer: 'Remplacer le ticket',
    }))) return;
    onReprendre(b);
  };

  const jeter = async (b: Brouillon) => {
    if (!(await confirmer({
      titre: `Supprimer « ${b.libelle} »`,
      message: 'Cette vente mise de côté sera perdue, sur ce poste comme sur les autres. Rien n’a été vendu ni sorti du stock.',
      libelleConfirmer: 'Supprimer',
      danger: true,
    }))) return;
    onSupprimer(b);
  };

  return (
    <Modal titre="Ventes en brouillon" sousTitre={`${brouillons.length} ticket(s) mis de côté dans la filiale`} largeur="max-w-xl" onClose={onClose}>
      {brouillons.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">
          Aucune vente mise de côté. Le bouton « Brouillon » garde le ticket en cours pour plus tard.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100" data-testid="liste-brouillons">
          {brouillons.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-3" data-testid="brouillon">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{b.libelle}</p>
                <p className="text-xs text-neutral-500">
                  {heure(b.cree_le)} · {b.articles} article(s)
                  {b.remise > 0 ? ` · remise ${formaterFcfa(b.remise)}` : ''}
                  {/* Ce qui vient d'ailleurs se dit : on sait à qui l'on prend le ticket. */}
                  {b.poste && b.poste !== moi && (
                    <span className="ml-1 text-primary-700">
                      · d’une autre caisse{b.utilisateur ? ` (${b.utilisateur})` : ''}
                    </span>
                  )}
                </p>
              </div>
              <p className="flex-shrink-0 font-mono text-sm font-bold text-primary-700">{formaterFcfa(b.total_ttc)}</p>
              <button
                type="button"
                onClick={() => reprendre(b)}
                className="flex items-center gap-1 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
                data-testid="reprendre-brouillon"
              >
                <ArrowUturnLeftIcon className="h-4 w-4" /> Reprendre
              </button>
              <button type="button" onClick={() => jeter(b)} className="rounded p-1.5 text-red-500 hover:bg-red-50" title="Supprimer ce brouillon">
                <TrashIcon className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Dit une fois, à l'endroit où la question se pose. */}
      <p className="mt-4 flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
        <UsersIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          Ces tickets sont partagés par <strong>toutes les caisses de la filiale</strong> : commencé ici,
          un ticket se reprend là-bas. Rien n’est vendu tant qu’il n’est pas encaissé — ni stock sorti,
          ni numéro tiré.
        </span>
      </p>
    </Modal>
  );
}
