import type { ComponentType } from 'react';
import {
  ArrowDownTrayIcon, ArrowsRightLeftIcon, BeakerIcon, ClipboardDocumentCheckIcon,
  CreditCardIcon, DocumentTextIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import { SECTIONS_HISTORIQUE, type SectionHistorique } from '../../../core/historiques';

/**
 * Une section, une icône — la même dans le sous-menu et sur le bandeau de la
 * carte qui porte sa liste. Deux icônes pour une même chose les feraient
 * passer pour deux écrans différents.
 */
export const ICONE_SECTION_HISTORIQUE: Record<SectionHistorique, ComponentType<{ className?: string }>> = {
  ventes: CreditCardIcon,
  'commandes-fournisseurs': DocumentTextIcon,
  entrees: ArrowDownTrayIcon,
  transferts: ArrowsRightLeftIcon,
  productions: BeakerIcon,
  destockages: TrashIcon,
  inventaires: ClipboardDocumentCheckIcon,
};

/** Sections du menu Historiques : sous-menu de la barre latérale (route `/historiques/<id>`). */
export const SECTIONS_HISTORIQUES = SECTIONS_HISTORIQUE.map((s) => ({ id: s.id, label: s.label, icon: ICONE_SECTION_HISTORIQUE[s.id] }));

export const SECTION_HISTORIQUE_DEFAUT: SectionHistorique = 'ventes';

export const cheminHistorique = (id: SectionHistorique) => `/historiques/${id}`;
