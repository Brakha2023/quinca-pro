import type { ComponentType } from 'react';
import { BookOpenIcon, ClipboardDocumentListIcon, DocumentDuplicateIcon, EnvelopeIcon, ScaleIcon, UserPlusIcon } from '@heroicons/react/24/outline';

export type SectionClients = 'repertoire' | 'nouveau' | 'proformas' | 'compte' | 'versements' | 'relance';

/** Sections du module Clients : sous-menu de la barre latérale (route `/clients/<id>`). */
export const SECTIONS_CLIENTS: Array<{ id: SectionClients; label: string; icon: ComponentType<{ className?: string }> }> = [
  { id: 'repertoire', label: 'Répertoire', icon: BookOpenIcon },
  { id: 'nouveau', label: 'Nouveau client', icon: UserPlusIcon },
  { id: 'proformas', label: 'Proforma à facture', icon: DocumentDuplicateIcon },
  { id: 'compte', label: 'Compte client', icon: ScaleIcon },
  { id: 'versements', label: 'Historique des versements', icon: ClipboardDocumentListIcon },
  { id: 'relance', label: 'Relance clients', icon: EnvelopeIcon },
];

export const SECTION_CLIENTS_DEFAUT: SectionClients = 'repertoire';

export function estSectionClients(v: string | undefined): v is SectionClients {
  return SECTIONS_CLIENTS.some((s) => s.id === v);
}

export const cheminClients = (id: SectionClients, clientId?: string) => `/clients/${id}${clientId ? `?id=${clientId}` : ''}`;
