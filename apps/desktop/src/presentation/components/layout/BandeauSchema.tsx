import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { titreDesaccord } from '../../../core/sync';
import { useVerificationSchema } from '../../features/sync/useVerificationSchema';

/**
 * Le serveur et le poste ne décrivent pas les mêmes données.
 *
 * C'est le défaut qui se voit le moins et coûte le plus : l'application a
 * l'air de fonctionner, les ventes s'enregistrent, et la file d'envoi reste
 * bloquée parce qu'une migration n'a pas été appliquée.
 */
export default function BandeauSchema() {
  const { desaccord, reverifier } = useVerificationSchema();
  if (!desaccord) return null;

  const bloquant = desaccord.bloquants.length > 0;
  const couleurs = bloquant ? 'bg-red-50 border-red-300 text-red-900' : 'bg-orange-50 border-orange-300 text-orange-900';

  return (
    <div className={`flex items-start gap-3 px-6 py-3 border-b ${couleurs} print:hidden`} role="alert" data-testid="bandeau-schema" data-niveau={bloquant ? 'BLOQUANT' : 'REMARQUE'}>
      <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-semibold">{titreDesaccord(desaccord)}</p>
        <ul className="text-sm mt-1 space-y-0.5">
          {[...desaccord.bloquants, ...desaccord.remarques].slice(0, 4).map((p) => <li key={p}>— {p}</li>)}
          {desaccord.bloquants.length + desaccord.remarques.length > 4 && <li>— et {desaccord.bloquants.length + desaccord.remarques.length - 4} autre(s)</li>}
        </ul>
        {bloquant && (
          <p className="text-sm mt-1">
            Les écritures qui portent ces champs seront refusées et mises de côté sur ce poste. Prévenez votre administrateur : une migration n'a pas été appliquée sur le serveur.
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={reverifier}
        className="ml-auto flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-current/30 hover:bg-white/60"
        data-testid="reverifier-schema"
      >
        Revérifier
      </button>
    </div>
  );
}
