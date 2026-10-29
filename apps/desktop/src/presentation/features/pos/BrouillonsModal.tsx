import { ArrowUturnLeftIcon, ComputerDesktopIcon, TrashIcon } from '@heroicons/react/24/outline';
import { formaterFcfa } from '../../hooks/useFormatage';
import Modal from '../../components/ui/Modal';
import { useConfirmation } from '../../confirmation/useConfirmation';
import type { BrouillonVente } from '../../stores/brouillons.store';

interface Props {
  brouillons: BrouillonVente[];
  /** Le ticket en cours n'est pas vide : le reprendre écrase quelque chose. */
  ticketEnCours: boolean;
  onReprendre: (brouillon: BrouillonVente) => void;
  onSupprimer: (id: string) => void;
  onClose: () => void;
}

const heure = (iso: string) => new Date(iso).toLocaleString('fr-FR', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});

/** Les ventes mises de côté sur ce poste : on en reprend une, ou on la jette. */
export default function BrouillonsModal({ brouillons, ticketEnCours, onReprendre, onSupprimer, onClose }: Props) {
  const confirmer = useConfirmation();

  const reprendre = async (b: BrouillonVente) => {
    if (ticketEnCours && !(await confirmer({
      titre: 'Reprendre ce brouillon',
      message: 'Le ticket en cours sera remplacé. Mettez-le d’abord en brouillon si vous voulez le garder.',
      libelleConfirmer: 'Remplacer le ticket',
    }))) return;
    onReprendre(b);
  };

  const jeter = async (b: BrouillonVente) => {
    if (!(await confirmer({
      titre: `Supprimer « ${b.libelle} »`,
      message: 'Cette vente mise de côté sera perdue. Rien n’a été vendu ni sorti du stock.',
      libelleConfirmer: 'Supprimer',
      danger: true,
    }))) return;
    onSupprimer(b.id);
  };

  return (
    <Modal titre="Ventes en brouillon" sousTitre={`${brouillons.length} ticket(s) mis de côté`} largeur="max-w-xl" onClose={onClose}>
      {brouillons.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-400">
          Aucune vente mise de côté. Le bouton « Mettre en brouillon » garde le ticket en cours pour plus tard.
        </p>
      ) : (
        <ul className="divide-y divide-neutral-100" data-testid="liste-brouillons">
          {brouillons.map((b) => (
            <li key={b.id} className="flex items-center gap-3 py-3" data-testid="brouillon">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-900">{b.libelle}</p>
                <p className="text-xs text-neutral-500">
                  {heure(b.cree_le)} · {b.articles} article(s)
                  {b.client ? ` · ${b.client.raison_sociale}` : ' · client comptoir'}
                  {b.remise > 0 ? ` · remise ${formaterFcfa(b.remise)}` : ''}
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
        <ComputerDesktopIcon className="mt-0.5 h-4 w-4 flex-shrink-0" />
        <span>
          Les brouillons restent sur <strong>ce poste</strong> et ne partent pas au serveur : rien n’est vendu
          tant que la vente n’est pas encaissée. Vous ne les retrouverez donc pas sur une autre machine.
        </span>
      </p>
    </Modal>
  );
}
