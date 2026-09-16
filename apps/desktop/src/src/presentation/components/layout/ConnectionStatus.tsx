import { useConnectionStatus } from '../../hooks/usePowerSync';
import { WifiIcon, SignalSlashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function ConnectionStatus() {
  const { connected, connecting, lastSyncedAt } = useConnectionStatus();

  const getStatusConfig = () => {
    if (connecting) {
      return {
        color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        icon: <ArrowPathIcon className="w-3 h-3 animate-spin" />,
        label: 'Connexion...',
      };
    }
    if (connected) {
      return {
        color: 'bg-green-50 text-green-700 border-green-200',
        icon: <WifiIcon className="w-3 h-3" />,
        label: lastSyncedAt 
          ? `Synchronisé (il y a ${Math.floor((Date.now() - new Date(lastSyncedAt).getTime()) / 60000)} min)`
          : 'Connecté',
      };
    }
    return {
      color: 'bg-red-50 text-red-700 border-red-200',
      icon: <SignalSlashIcon className="w-3 h-3" />,
      label: 'Hors ligne',
    };
  };

  const config = getStatusConfig();

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border ${config.color}`}>
      {config.icon}
      <span>{config.label}</span>
    </div>
  );
}