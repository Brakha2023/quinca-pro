import type { ComponentType } from 'react';
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowsRightLeftIcon, BellIcon, BeakerIcon,
  BuildingOffice2Icon, ClipboardDocumentCheckIcon, ClipboardDocumentListIcon, CubeIcon,
} from '@heroicons/react/24/outline';

export type OngletStock = 'alertes' | 'suivi' | 'entree' | 'sortie' | 'transfert' | 'transfert-filiale' | 'inventaire' | 'production' | 'mouvements';

/** Sections du module Stock : onglets de la page et sous-menu de la barre latérale (route `/stock/<id>`). */
export const ONGLETS_STOCK: Array<{ id: OngletStock; label: string; icon: ComponentType<{ className?: string }> }> = [
  // Les alertes d'abord : c'est ce qu'on vient voir en arrivant, avant de saisir quoi que ce soit.
  { id: 'alertes', label: 'Alertes', icon: BellIcon },
  { id: 'suivi', label: 'Suivi de stock', icon: CubeIcon },
  { id: 'entree', label: 'Entrée', icon: ArrowDownTrayIcon },
  { id: 'sortie', label: 'Sortie / Casse', icon: ArrowUpTrayIcon },
  { id: 'transfert', label: 'Transfert entre dépôts', icon: ArrowsRightLeftIcon },
  { id: 'transfert-filiale', label: 'Transfert entre filiales', icon: BuildingOffice2Icon },
  { id: 'inventaire', label: 'Inventaire', icon: ClipboardDocumentCheckIcon },
  { id: 'production', label: 'Production', icon: BeakerIcon },
  { id: 'mouvements', label: 'Mouvements', icon: ClipboardDocumentListIcon },
];

export const ONGLET_STOCK_DEFAUT: OngletStock = 'alertes';

export function estOngletStock(v: string | undefined): v is OngletStock {
  return ONGLETS_STOCK.some((o) => o.id === v);
}

export const cheminOngletStock = (id: OngletStock) => `/stock/${id}`;
