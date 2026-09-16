import { useState } from 'react';
import { connectPowerSync } from '../../services/powersync.client';
import { CloudArrowUpIcon } from '@heroicons/react/24/outline';

export default function PowerSyncConnectButton() {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await connectPowerSync();
      setConnected(true);
      alert('✅ PowerSync connecté ! Recharge la page pour voir les données synchronisées.');
    } catch (error) {
      console.error('Erreur:', error);
      alert('❌ Erreur de connexion. Vérifie la console.');
    } finally {
      setConnecting(false);
    }
  };

  if (connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
        <CloudArrowUpIcon className="w-3 h-3" />
        <span>Connecté</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={connecting}
      className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white rounded-full text-xs font-medium transition-colors"
    >
      <CloudArrowUpIcon className={`w-3 h-3 ${connecting ? 'animate-spin' : ''}`} />
      <span>{connecting ? 'Connexion...' : 'Connecter PowerSync'}</span>
    </button>
  );
}