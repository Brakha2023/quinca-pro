import { useStatus } from '@powersync/react';
import { ArrowPathIcon, CloudArrowUpIcon, SignalSlashIcon, WifiIcon } from '@heroicons/react/24/outline';

function formatRelative(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}

/** Indicateur d'état de la synchronisation PowerSync (lecture seule, temps réel). */
export default function SyncStatusBadge() {
  const status = useStatus();

  let tone = 'bg-red-50 text-red-700 border-red-200';
  let icon = <SignalSlashIcon className="w-3.5 h-3.5" />;
  let label = 'Hors ligne';

  if (status.connecting) {
    tone = 'bg-yellow-50 text-yellow-700 border-yellow-200';
    icon = <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />;
    label = 'Connexion…';
  } else if (status.connected) {
    tone = 'bg-green-50 text-green-700 border-green-200';
    if (status.uploading || status.downloading) {
      icon = <CloudArrowUpIcon className="w-3.5 h-3.5 animate-pulse" />;
      label = status.uploading ? 'Envoi…' : 'Réception…';
    } else {
      icon = <WifiIcon className="w-3.5 h-3.5" />;
      label = status.lastSyncedAt ? `Synchronisé ${formatRelative(status.lastSyncedAt)}` : 'Connecté';
    }
  } else if (status.lastSyncedAt) {
    label = `Hors ligne · dernière sync ${formatRelative(status.lastSyncedAt)}`;
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${tone}`}
      title={status.uploadError?.message ?? status.downloadError?.message ?? undefined}
    >
      {icon}
      <span>{label}</span>
    </div>
  );
}
