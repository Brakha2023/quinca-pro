import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import Modal from '../components/ui/Modal';
import { ConfirmationContext, type DemandeConfirmation } from './ConfirmationContext';

interface EnAttente extends DemandeConfirmation {
  resoudre: (ok: boolean) => void;
}

/**
 * Boîte de confirmation applicative. Remplace `window.confirm`, que la WebView
 * de Tauri ne prend pas en charge (elle renvoie `false` sans rien afficher).
 */
export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [enAttente, setEnAttente] = useState<EnAttente | null>(null);

  const confirmer = useCallback(
    (demande: DemandeConfirmation) =>
      new Promise<boolean>((resoudre) => {
        setEnAttente({ ...demande, resoudre });
      }),
    [],
  );

  const repondre = (ok: boolean) => {
    enAttente?.resoudre(ok);
    setEnAttente(null);
  };

  const value = useMemo(() => ({ confirmer }), [confirmer]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {enAttente && (
        <Modal
          titre={enAttente.titre ?? 'Confirmation'}
          largeur="max-w-md"
          onClose={() => repondre(false)}
          pied={
            <>
              <button type="button" onClick={() => repondre(false)} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">
                Annuler
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => repondre(true)}
                className={`px-4 py-2 text-white font-medium rounded-lg ${enAttente.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'}`}
              >
                {enAttente.libelleConfirmer ?? 'Confirmer'}
              </button>
            </>
          }
        >
          <div className="flex gap-3">
            {enAttente.danger && <ExclamationTriangleIcon className="w-6 h-6 text-red-600 shrink-0" />}
            <p className="text-sm text-neutral-700 whitespace-pre-line">{enAttente.message}</p>
          </div>
        </Modal>
      )}
    </ConfirmationContext.Provider>
  );
}
