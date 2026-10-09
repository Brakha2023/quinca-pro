import type { ComponentType } from 'react';
import {
  ArrowDownTrayIcon, ArrowUpTrayIcon, ArrowsRightLeftIcon, BanknotesIcon, BuildingOffice2Icon, ReceiptPercentIcon, WalletIcon,
} from '@heroicons/react/24/outline';

export type SectionTresorerie = 'caisses' | 'versement' | 'retrait' | 'entree' | 'transfert-caisse' | 'transfert-filiale' | 'depense';

/** Sections du module Trésorerie : sous-menu de la barre latérale (route `/tresorerie/<id>`). */
export const SECTIONS_TRESORERIE: Array<{ id: SectionTresorerie; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'caisses', label: 'Liste des caisses', icon: WalletIcon },
  { id: 'versement', label: 'Versement', icon: BanknotesIcon },
  { id: 'retrait', label: 'Retrait', icon: ArrowUpTrayIcon },
  { id: 'entree', label: 'Entrée en caisse', icon: ArrowDownTrayIcon },
  { id: 'transfert-caisse', label: 'Transfert inter caisse', icon: ArrowsRightLeftIcon },
  { id: 'transfert-filiale', label: 'Transfert inter filiale', icon: BuildingOffice2Icon },
  { id: 'depense', label: 'Dépense', icon: ReceiptPercentIcon },
];

export const SECTION_TRESORERIE_DEFAUT: SectionTresorerie = 'caisses';

export function estSectionTresorerie(v: string | undefined): v is SectionTresorerie {
  return SECTIONS_TRESORERIE.some((s) => s.id === v);
}

export const cheminTresorerie = (id: SectionTresorerie) => `/tresorerie/${id}`;
