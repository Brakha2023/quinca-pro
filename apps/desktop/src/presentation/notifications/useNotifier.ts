import { useContext } from 'react';
import { NotificationsContext } from './NotificationsContext';

export function useNotifier() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifier doit être utilisé sous <NotificationsProvider>');
  return ctx.notifier;
}
