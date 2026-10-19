import type { ComponentType } from 'react';
import { ShieldCheckIcon, UserGroupIcon } from '@heroicons/react/24/outline';

export type SectionParametres = 'roles' | 'utilisateurs';

export interface OngletParametres {
  id: SectionParametres;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Ce que la section demande pour s'ouvrir. */
  permission: string;
}

/** Sections du menu Paramètres : sous-menu de la barre latérale (route `/parametres/<id>`). */
export const SECTIONS_PARAMETRES: OngletParametres[] = [
  { id: 'roles', label: 'Rôles & permissions', icon: ShieldCheckIcon, permission: 'parametres.lire' },
  { id: 'utilisateurs', label: 'Utilisateurs', icon: UserGroupIcon, permission: 'parametres.lire' },
];

export const SECTION_PARAMETRES_DEFAUT: SectionParametres = 'roles';

export const estSectionParametres = (v: string | undefined): v is SectionParametres =>
  SECTIONS_PARAMETRES.some((s) => s.id === v);

export const cheminParametres = (id: SectionParametres) => `/parametres/${id}`;
