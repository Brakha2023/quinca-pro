import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  titre: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  onClose: () => void;
  children: ReactNode;
}

/**
 * Aperçu plein écran d'un document A4 (bon de commande, balance, relevé…),
 * rendu dans la zone d'impression : à l'impression, seule cette zone sort
 * (voir `@media print`), sans la barre d'outils.
 */
export default function DocumentImprimable({ titre, filiale, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div id="zone-impression" className="apercu-impression" role="dialog" aria-label={`Aperçu — ${titre}`}>
      <div className="apercu-barre">
        <span>{titre}</span>
        <div>
          <button type="button" onClick={() => window.print()} className="apercu-bouton apercu-bouton-primaire"><PrinterIcon className="w-4 h-4" /> Imprimer</button>
          <button type="button" onClick={onClose} className="apercu-bouton" aria-label="Fermer l'aperçu"><XMarkIcon className="w-4 h-4" /> Fermer</button>
        </div>
      </div>
      <div className="document">
        <header className="document-entete">
          <div className="document-logo">QCF</div>
          <div className="document-societe">
            <p className="document-societe-nom">{filiale.nom}</p>
            {filiale.adresse && <p>{filiale.adresse}</p>}
            {filiale.telephone && <p>Tél. {filiale.telephone}</p>}
          </div>
        </header>
        <h1 className="document-titre">{titre}</h1>
        {children}
      </div>
    </div>,
    document.body,
  );
}
