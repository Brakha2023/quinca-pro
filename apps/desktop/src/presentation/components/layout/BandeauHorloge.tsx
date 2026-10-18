import { ClockIcon } from '@heroicons/react/24/outline';
import { depuisMaintenant } from './etatSynchronisation';
import { useDeriveHorloge } from '../../features/sync/useDeriveHorloge';

/**
 * Horloge du poste fausse : toutes les pièces créées ici en porteront l'heure.
 * Le bandeau reste affiché hors ligne — une horloge ne se corrige pas toute
 * seule — et le bouton laisse repartir à zéro après le réglage.
 */
export default function BandeauHorloge() {
  const { mesure, avertissement, horlogeReglee } = useDeriveHorloge();
  if (!avertissement || !mesure) return null;

  const bloquant = avertissement.niveau === 'BLOCAGE';
  const couleurs = bloquant ? 'bg-red-50 border-red-300 text-red-900' : 'bg-orange-50 border-orange-300 text-orange-900';

  return (
    <div className={`flex items-start gap-3 px-6 py-3 border-b ${couleurs} print:hidden`} role="alert" data-testid="bandeau-horloge" data-niveau={avertissement.niveau}>
      <ClockIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div className="min-w-0">
        <p className="font-semibold">{avertissement.titre}</p>
        <p className="text-sm mt-0.5">{avertissement.message}</p>
        <p className="text-xs mt-1 opacity-80">Écart mesuré {depuisMaintenant(new Date(mesure.mesuree_a))} sur le jeton signé par le serveur.</p>
      </div>
      <button
        type="button"
        onClick={horlogeReglee}
        className="ml-auto flex-shrink-0 px-3 py-1.5 text-sm font-medium rounded-lg border border-current/30 hover:bg-white/60"
        data-testid="horloge-reglee"
      >
        J'ai réglé l'horloge
      </button>
    </div>
  );
}
