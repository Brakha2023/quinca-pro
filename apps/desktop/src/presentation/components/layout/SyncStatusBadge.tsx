import { ArrowPathIcon, CloudArrowUpIcon, ExclamationTriangleIcon, SignalSlashIcon, WifiIcon } from '@heroicons/react/24/outline';
import { useFileEnvoi } from '../../auth/useFileEnvoi';
import { etatSynchronisation, type NatureEtatSync } from './etatSynchronisation';
import { useStatus } from '@powersync/react';

const STYLES: Record<NatureEtatSync, string> = {
  HORS_LIGNE: 'bg-red-50 text-red-700 border-red-200',
  CONNEXION: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  // Connecté mais rien ne remonte : à distinguer du hors-ligne, qui lui est normal et attendu.
  BLOQUE: 'bg-orange-100 text-orange-800 border-orange-300 font-semibold',
  ECHANGE: 'bg-green-50 text-green-700 border-green-200',
  A_JOUR: 'bg-green-50 text-green-700 border-green-200',
};

const ICONES: Record<NatureEtatSync, typeof WifiIcon> = {
  HORS_LIGNE: SignalSlashIcon,
  CONNEXION: ArrowPathIcon,
  BLOQUE: ExclamationTriangleIcon,
  ECHANGE: CloudArrowUpIcon,
  A_JOUR: WifiIcon,
};

/** Indicateur d'état de la synchronisation PowerSync (lecture seule, temps réel). */
export default function SyncStatusBadge() {
  const status = useStatus();
  const { enAttente } = useFileEnvoi();
  const etat = etatSynchronisation(status, enAttente);
  const Icone = ICONES[etat.nature];
  const anime = etat.nature === 'CONNEXION' ? 'animate-spin' : etat.nature === 'ECHANGE' ? 'animate-pulse' : '';

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${STYLES[etat.nature]}`}
      title={etat.detail}
      data-testid="etat-sync"
      data-nature={etat.nature}
    >
      <Icone className={`w-3.5 h-3.5 ${anime}`} />
      <span>{etat.label}</span>
    </div>
  );
}
