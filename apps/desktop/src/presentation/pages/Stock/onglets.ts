import type { ComponentType } from 'react';
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowsRightLeftIcon, BellIcon, BeakerIcon,
  ClipboardDocumentCheckIcon, ClipboardDocumentListIcon, CubeIcon,
} from '@heroicons/react/24/outline';

export type OngletStock = 'suivi' | 'entree' | 'sortie' | 'transfert' | 'inventaire' | 'production' | 'mouvements' | 'alertes';

/** Sections du module Stock : onglets de la page et sous-menu de la barre latérale (route `/stock/<id>`). */
export const ONGLETS_STOCK: Array<{ id: OngletStock; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'suivi', label: 'Suivi de stock', icon: CubeIcon },
  { id: 'entree', label: 'Entrée', icon: ArrowDownTrayIcon },
  { id: 'sortie', label: 'Sortie / Casse', icon: ArrowUpTrayIcon },
  { id: 'transfert', label: 'Transfert', icon: ArrowsRightLeftIcon },
  { id: 'inventaire', label: 'Inventaire', icon: ClipboardDocumentCheckIcon },
  { id: 'production', label: 'Production', icon: BeakerIcon },
  { id: 'mouvements', label: 'Mouvements', icon: ClipboardDocumentListIcon },
  { id: 'alertes', label: 'Alertes', icon: BellIcon },
];

export const ONGLET_STOCK_DEFAUT: OngletStock = 'suivi';

export function estOngletStock(v: string | undefined): v is OngletStock {
  return ONGLETS_STOCK.some((o) => o.id === v);
}

export const cheminOngletStock = (id: OngletStock) => `/stock/${id}`;
