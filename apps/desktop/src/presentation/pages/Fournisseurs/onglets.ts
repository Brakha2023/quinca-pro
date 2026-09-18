import type { ComponentType } from 'react';
import { BookOpenIcon, ClipboardDocumentListIcon, DocumentTextIcon, EnvelopeIcon, ScaleIcon, UserPlusIcon } from '@heroicons/react/24/outline';

export type SectionFournisseurs = 'repertoire' | 'nouveau' | 'compte' | 'reglements' | 'commandes' | 'relance';

/** Sections du module Fournisseurs : sous-menu de la barre latérale (route `/fournisseurs/<id>`). */
export const SECTIONS_FOURNISSEURS: Array<{ id: SectionFournisseurs; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'repertoire', label: 'Répertoire', icon: BookOpenIcon },
  { id: 'nouveau', label: 'Nouveau fournisseur', icon: UserPlusIcon },
  { id: 'compte', label: 'Compte fournisseur', icon: ScaleIcon },
  { id: 'reglements', label: 'Historique des règlements', icon: ClipboardDocumentListIcon },
  { id: 'commandes', label: 'Bons de commande', icon: DocumentTextIcon },
  { id: 'relance', label: 'Relance fournisseur', icon: EnvelopeIcon },
];

export const SECTION_FOURNISSEURS_DEFAUT: SectionFournisseurs = 'repertoire';

export function estSectionFournisseurs(v: string | undefined): v is SectionFournisseurs {
  return SECTIONS_FOURNISSEURS.some((s) => s.id === v);
}

export const cheminFournisseurs = (id: SectionFournisseurs, fournisseurId?: string) => `/fournisseurs/${id}${fournisseurId ? `?id=${fournisseurId}` : ''}`;
