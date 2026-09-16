import { useState, useEffect } from 'react';
import { usePowerSync } from '../services/powersync.client';

// Hook pour requêter PowerSync en temps réel
export function usePowerSyncQuery<T = any>(query: string, parameters: any[] = []): { data: T[], loading: boolean, error: string | null } {
  const db = usePowerSync();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!db) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await db.execute(query, parameters);
        if (!cancelled) {
          setData(result.rows?._array || []);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Erreur PowerSync:', err);
          setError(err.message || 'Erreur inconnue');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    // Polling toutes les 3 secondes pour simuler le temps réel
    const interval = setInterval(fetchData, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [db, query]);

  return { data, loading, error };
}

// Hook pour exécuter une mutation
export function usePowerSyncMutation() {
  const db = usePowerSync();

  const execute = async (sql: string, parameters: any[] = []) => {
    if (!db) throw new Error('Base de données non connectée');
    const result = await db.execute(sql, parameters);
    console.log('✅ Mutation exécutée:', sql.substring(0, 50));
    return result;
  };

  return { execute };
}

// Hook pour le statut de connexion
export function useConnectionStatus() {
  const db = usePowerSync();
  const [status, setStatus] = useState({
    connected: false,
    connecting: false,
    lastSyncedAt: null as string | null,
  });

  useEffect(() => {
    if (!db) return;

    const updateStatus = () => {
      setStatus({
        connected: db.connected,
        connecting: db.connecting,
        lastSyncedAt: db.lastSyncedAt,
      });
    };

    updateStatus();
    const interval = setInterval(updateStatus, 2000);
    return () => clearInterval(interval);
  }, [db]);

  return status;
}