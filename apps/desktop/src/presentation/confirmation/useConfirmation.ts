import { useContext } from 'react';
import { ConfirmationContext } from './ConfirmationContext';

export function useConfirmation() {
  const ctx = useContext(ConfirmationContext);
  if (!ctx) throw new Error('useConfirmation doit être utilisé sous <ConfirmationProvider>');
  return ctx.confirmer;
}
