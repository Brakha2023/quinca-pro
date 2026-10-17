/** Ce que le poste a besoin de savoir de la synchronisation, en un coup d'œil. */
export type NatureEtatSync = 'HORS_LIGNE' | 'CONNEXION' | 'BLOQUE' | 'MIS_DE_COTE' | 'ECHANGE' | 'A_JOUR';

export interface EtatSync {
  nature: NatureEtatSync;
  label: string;
  /** Détail affiché en infobulle (message d'erreur du serveur, le cas échéant). */
  detail?: string;
}

/** Ce que contient la file d'envoi du poste. */
export interface FileEnvoi {
  /** Écritures qui attendent leur tour (normal hors ligne). */
  enAttente: number;
  /** Écritures que le serveur a refusées définitivement et qui attendent une décision. */
  misDeCote: number;
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
 * Vient ensuite `MIS_DE_COTE` : la file avance, mais le serveur a refusé des
 * écritures définitivement et elles attendent une décision (voir `core/sync`).
 * Le blocage passe devant, parce qu'alors plus rien ne remonte du tout.
 *
 * Hors ligne avec des écritures en attente n'est pas un blocage : c'est le
 * fonctionnement normal du poste, et le dire autrement affolerait pour rien.
 */
export function etatSynchronisation(statut: StatutSync, file: FileEnvoi, maintenant = new Date()): EtatSync {
  const { enAttente, misDeCote } = file;
  const rappelMisesDeCote = misDeCote > 0 ? `\n\nEt ${misDeCote} écriture(s) mise(s) de côté : cliquez pour les voir.` : '';

  if (statut.connected && statut.uploadError && enAttente > 0) {
    return {
      nature: 'BLOQUE',
      label: `Envoi bloqué · ${enAttente} en attente`,
      detail: `${statut.uploadError.message}\n\nLes écritures restent sur ce poste et seront envoyées une fois le problème corrigé. Prévenez votre administrateur.${rappelMisesDeCote}`,
    };
  }
  if (misDeCote > 0) {
    return {
      nature: 'MIS_DE_COTE',
      label: `${misDeCote} écriture(s) mise(s) de côté`,
      detail: `Le serveur a refusé ${misDeCote === 1 ? 'cette écriture' : 'ces écritures'} définitivement. ${misDeCote === 1 ? 'Elle est conservée' : 'Elles sont conservées'} sur ce poste : cliquez pour voir le motif, réessayer ou abandonner. Le reste de la synchronisation continue.`,
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
