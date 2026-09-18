import type { ComponentType } from 'react';
import { BanknotesIcon, CalculatorIcon, ClipboardDocumentCheckIcon, UserPlusIcon, UsersIcon } from '@heroicons/react/24/outline';

export type SectionEmployes = 'effectif' | 'nouveau' | 'pointage' | 'paie' | 'paiement';

/** Sections du module Employés : sous-menu de la barre latérale (route `/employes/<id>`). */
export const SECTIONS_EMPLOYES: Array<{ id: SectionEmployes; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'effectif', label: 'Effectif', icon: UsersIcon },
  { id: 'nouveau', label: 'Nouveau employé', icon: UserPlusIcon },
  { id: 'pointage', label: 'Pointage', icon: ClipboardDocumentCheckIcon },
  { id: 'paie', label: 'Paie / salaire', icon: CalculatorIcon },
  { id: 'paiement', label: 'Paiement de salaire', icon: BanknotesIcon },
];

export const SECTION_EMPLOYES_DEFAUT: SectionEmployes = 'effectif';

export function estSectionEmployes(v: string | undefined): v is SectionEmployes {
  return SECTIONS_EMPLOYES.some((s) => s.id === v);
}

export const cheminEmployes = (id: SectionEmployes, employeId?: string) => `/employes/${id}${employeId ? `?id=${employeId}` : ''}`;
