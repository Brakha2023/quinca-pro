import { createContext } from 'react';

export type NiveauNotification = 'succes' | 'erreur' | 'info';

export interface Notification {
  id: number;
  niveau: NiveauNotification;
  texte: string;
}

export interface NotificationsContextValue {
  notifier: (niveau: NiveauNotification, texte: string) => void;
}

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);
