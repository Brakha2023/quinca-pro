import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { NotificationsContext, type NiveauNotification, type Notification } from './NotificationsContext';

const DUREE_MS: Record<NiveauNotification, number> = { succes: 4000, info: 5000, erreur: 8000 };

const STYLES: Record<NiveauNotification, { boite: string; icone: ReactNode }> = {
  succes: { boite: 'bg-green-50 border-green-200 text-green-800', icone: <CheckCircleIcon className="w-5 h-5 text-green-600" /> },
  erreur: { boite: 'bg-red-50 border-red-200 text-red-800', icone: <ExclamationCircleIcon className="w-5 h-5 text-red-600" /> },
  info: { boite: 'bg-blue-50 border-blue-200 text-blue-800', icone: <InformationCircleIcon className="w-5 h-5 text-blue-600" /> },
};

let compteur = 0;

/** Notifications non bloquantes (remplacent les `alert()`), empilées en haut à droite. */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const fermer = useCallback((id: number) => {
    setNotifications((list) => list.filter((n) => n.id !== id));
  }, []);

  const notifier = useCallback(
    (niveau: NiveauNotification, texte: string) => {
      const id = ++compteur;
      setNotifications((list) => [...list, { id, niveau, texte }]);
      window.setTimeout(() => fermer(id), DUREE_MS[niveau]);
    },
    [fermer],
  );

  const value = useMemo(() => ({ notifier }), [notifier]);

  return (
    <NotificationsContext.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] space-y-2 w-96 max-w-[calc(100vw-2rem)] print:hidden" aria-live="polite">
        {notifications.map((n) => (
          <div key={n.id} className={`flex items-start gap-3 px-4 py-3 rounded-lg border shadow-lg text-sm ${STYLES[n.niveau].boite}`}>
            {STYLES[n.niveau].icone}
            <span className="flex-1 whitespace-pre-line">{n.texte}</span>
            <button onClick={() => fermer(n.id)} className="p-0.5 rounded hover:bg-black/5" aria-label="Fermer">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </NotificationsContext.Provider>
  );
}
