import type { ComponentType } from 'react';
import {
  ArrowDownTrayIcon, ArrowsRightLeftIcon, BeakerIcon, ClipboardDocumentCheckIcon,
  CreditCardIcon, DocumentTextIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import { SECTIONS_HISTORIQUE, type SectionHistorique } from '../../../core/historiques';

const ICONES: Record<SectionHistorique, ComponentType<{ className?: string }>> = {
  ventes: CreditCardIcon,
  'commandes-fournisseurs': DocumentTextIcon,
  entrees: ArrowDownTrayIcon,
  transferts: ArrowsRightLeftIcon,
  productions: BeakerIcon,
  destockages: TrashIcon,
  inventaires: ClipboardDocumentCheckIcon,
};

/** Sections du menu Historiques : sous-menu de la barre latérale (route `/historiques/<id>`). */
export const SECTIONS_HISTORIQUES = SECTIONS_HISTORIQUE.map((s) => ({ id: s.id, label: s.label, icon: ICONES[s.id] }));

export const SECTION_HISTORIQUE_DEFAUT: SectionHistorique = 'ventes';

export const cheminHistorique = (id: SectionHistorique) => `/historiques/${id}`;
