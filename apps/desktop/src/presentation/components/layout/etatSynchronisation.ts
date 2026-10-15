/** Ce que le poste a besoin de savoir de la synchronisation, en un coup d'œil. */
export type NatureEtatSync = 'HORS_LIGNE' | 'CONNEXION' | 'BLOQUE' | 'ECHANGE' | 'A_JOUR';

export interface EtatSync {
  nature: NatureEtatSync;
  label: string;
  /** Détail affiché en infobulle (message d'erreur du serveur, le cas échéant). */
  detail?: string;
}

export interface StatutSync {
  connected: boolean;
  connecting: boolean;
  uploading: boolean;
  downloading: boolean;
  uploadError?: Error;
  lastSyncedAt?: Date;
}

export function depuisMaintenant(date: Date, maintenant = new Date()): string {
  const minutes = Math.floor((maintenant.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.floor(minutes / 60)} h`;
}

/**
 * État affiché par le bandeau.
 *
 * Le cas qui compte est `BLOQUE` : **connecté**, mais le serveur refuse les
 * écritures (colonne absente après une mise à jour non appliquée, règle de
 * sécurité). PowerSync réessaie sans fin — rien n'est perdu, mais plus rien ne
 * remonte, et sans cet état le bandeau afficherait « Synchronisé » en vert
 * pendant que la file grossit.
 *
 * Hors ligne avec des écritures en attente n'est pas un blocage : c'est le
 * fonctionnement normal du poste, et le dire autrement affolerait pour rien.
 */
export function etatSynchronisation(statut: StatutSync, enAttente: number, maintenant = new Date()): EtatSync {
  if (statut.connected && statut.uploadError && enAttente > 0) {
    return {
      nature: 'BLOQUE',
      label: `Envoi bloqué · ${enAttente} en attente`,
      detail: `${statut.uploadError.message}\n\nLes écritures restent sur ce poste et seront envoyées une fois le problème corrigé. Prévenez votre administrateur.`,
    };
  }
  if (statut.connecting) return { nature: 'CONNEXION', label: 'Connexion…' };
  if (statut.connected) {
    if (statut.uploading || statut.downloading) {
      return { nature: 'ECHANGE', label: statut.uploading ? 'Envoi…' : 'Réception…' };
    }
    return {
      nature: 'A_JOUR',
      label: statut.lastSyncedAt ? `Synchronisé ${depuisMaintenant(statut.lastSyncedAt, maintenant)}` : 'Connecté',
    };
  }
  return {
    nature: 'HORS_LIGNE',
    label: statut.lastSyncedAt ? `Hors ligne · dernière sync ${depuisMaintenant(statut.lastSyncedAt, maintenant)}` : 'Hors ligne',
  };
}
