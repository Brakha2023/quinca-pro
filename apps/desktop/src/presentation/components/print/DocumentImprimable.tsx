import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { PrinterIcon, XMarkIcon } from '@heroicons/react/24/outline';
import Bouton from '../../components/ui/Bouton';
import CorpsDocument from './CorpsDocument';

interface Props {
  titre: string;
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  /** Nature de la pièce : voir `CorpsDocument`. */
  nature?: string;
  /** Feuille couchée : pour les listes larges (voir `CorpsDocument`). */
  paysage?: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Aperçu plein écran d'un document A4 (bon de commande, balance, relevé…),
 * rendu dans la zone d'impression : à l'impression, seule cette zone sort
 * (voir `@media print`), sans la barre d'outils. La feuille elle-même est
 * `CorpsDocument`, qui lui donne l'identité de la maison.
 */
export default function DocumentImprimable({ titre, filiale, nature, paysage, onClose, children }: Props) {
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
          <Bouton onClick={() => window.print()} icone={PrinterIcon} className="apercu-bouton apercu-bouton-primaire">Imprimer</Bouton>
          <button type="button" onClick={onClose} className="apercu-bouton" aria-label="Fermer l'aperçu"><XMarkIcon className="w-4 h-4" /> Fermer</button>
        </div>
      </div>
      <CorpsDocument titre={titre} filiale={filiale} nature={nature} paysage={paysage}>{children}</CorpsDocument>
    </div>,
    document.body,
  );
}
