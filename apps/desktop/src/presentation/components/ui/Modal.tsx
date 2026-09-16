import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface ModalProps {
  titre: string;
  sousTitre?: string;
  onClose: () => void;
  children: ReactNode;
  /** Largeur max Tailwind, ex. `max-w-2xl`. */
  largeur?: string;
  pied?: ReactNode;
}

/** Boîte de dialogue modale : fermeture par Échap, clic sur le fond ou la croix. */
export default function Modal({ titre, sousTitre, onClose, children, largeur = 'max-w-2xl', pied }: ModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className={`bg-white rounded-xl w-full ${largeur} max-h-[90vh] flex flex-col shadow-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-6 border-b border-neutral-200">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">{titre}</h3>
            {sousTitre && <p className="text-sm text-neutral-500 mt-0.5">{sousTitre}</p>}
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg" aria-label="Fermer">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        {pied && <div className="p-4 border-t border-neutral-200 flex justify-end gap-3">{pied}</div>}
      </div>
    </div>,
    document.body,
  );
}
