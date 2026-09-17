import { createContext } from 'react';

export interface DemandeConfirmation {
  titre?: string;
  message: string;
  /** Libellé du bouton de confirmation (« Confirmer » par défaut). */
  libelleConfirmer?: string;
  /** Action irréversible : bouton rouge. */
  danger?: boolean;
}

export interface ConfirmationContextValue {
  /** Affiche une boîte de confirmation et résout `true` si l'utilisateur confirme. */
  confirmer: (demande: DemandeConfirmation) => Promise<boolean>;
}

export const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);
