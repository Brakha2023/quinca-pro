import { useState } from 'react';
import { ArrowPathIcon, CloudArrowUpIcon, ExclamationTriangleIcon, InboxStackIcon, SignalSlashIcon, WifiIcon } from '@heroicons/react/24/outline';
import { useFileEnvoi } from '../../auth/useFileEnvoi';
import EchecsEnvoiModal from '../../features/sync/EchecsEnvoiModal';
import { useEchecsEnvoi } from '../../features/sync/useEchecsEnvoi';
import { etatSynchronisation, type NatureEtatSync } from './etatSynchronisation';
import { useStatus } from '@powersync/react';

const STYLES: Record<NatureEtatSync, string> = {
  HORS_LIGNE: 'bg-red-50 text-red-700 border-red-200',
  CONNEXION: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  // Connecté mais rien ne remonte : à distinguer du hors-ligne, qui lui est normal et attendu.
  BLOQUE: 'bg-orange-100 text-orange-800 border-orange-300 font-semibold',
  // Des écritures attendent une décision : même alerte que le blocage, cliquable.
  MIS_DE_COTE: 'bg-orange-100 text-orange-800 border-orange-300 font-semibold',
  ECHANGE: 'bg-green-50 text-green-700 border-green-200',
  A_JOUR: 'bg-green-50 text-green-700 border-green-200',
};

const ICONES: Record<NatureEtatSync, typeof WifiIcon> = {
  HORS_LIGNE: SignalSlashIcon,
  CONNEXION: ArrowPathIcon,
  BLOQUE: ExclamationTriangleIcon,
  MIS_DE_COTE: InboxStackIcon,
  ECHANGE: CloudArrowUpIcon,
  A_JOUR: WifiIcon,
};

/** Indicateur d'état de la synchronisation PowerSync (lecture seule, temps réel). */
export default function SyncStatusBadge() {
  const status = useStatus();
  const { enAttente } = useFileEnvoi();
  const { echecs } = useEchecsEnvoi();
  const misDeCote = echecs.length;
  const [liste, setListe] = useState(false);
  const etat = etatSynchronisation(status, { enAttente, misDeCote });
  const Icone = ICONES[etat.nature];
  const anime = etat.nature === 'CONNEXION' ? 'animate-spin' : etat.nature === 'ECHANGE' ? 'animate-pulse' : '';
  const classes = `flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${STYLES[etat.nature]}`;

  return (
    <>
      {misDeCote > 0 ? (
        <button type="button" onClick={() => setListe(true)} className={`${classes} hover:brightness-95`} title={etat.detail} data-testid="etat-sync" data-nature={etat.nature}>
          <Icone className={`w-3.5 h-3.5 ${anime}`} />
          <span>{etat.label}</span>
        </button>
      ) : (
        <div className={classes} title={etat.detail} data-testid="etat-sync" data-nature={etat.nature}>
          <Icone className={`w-3.5 h-3.5 ${anime}`} />
          <span>{etat.label}</span>
        </div>
      )}
      {liste && <EchecsEnvoiModal onClose={() => setListe(false)} />}
    </>
  );
}
