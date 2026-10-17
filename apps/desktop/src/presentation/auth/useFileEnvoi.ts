import { useQuery, useStatus } from '@powersync/react';

/** Nombre d'écritures locales en attente d'envoi au serveur et état de la connexion. */
export function useFileEnvoi() {
  const status = useStatus();
  const { data } = useQuery<{ n: number }>('SELECT COUNT(*) AS n FROM ps_crud');
  return { enAttente: data[0]?.n ?? 0, connecte: status.connected };
}
