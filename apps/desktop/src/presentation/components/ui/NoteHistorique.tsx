import { libelleHistoriqueLocal } from '../../../core/sync';

/**
 * Le poste ne garde qu'une année d'activité (voir `core/sync/historique`).
 * Il faut le dire là où l'on consulte un historique, sinon une liste tronquée
 * se lit comme une liste complète.
 */
export default function NoteHistorique({ quoi }: { quoi: string }) {
  return (
    <p className="text-xs text-neutral-500" data-testid="note-historique">
      Ce poste garde {quoi} {libelleHistoriqueLocal()}. Au-delà, l'historique reste sur le serveur — sauf les pièces non soldées, qui restent ici quel que soit leur âge.
    </p>
  );
}
