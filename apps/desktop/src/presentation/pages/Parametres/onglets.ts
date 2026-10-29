import type { ComponentType } from 'react';
import {
  AdjustmentsHorizontalIcon, BuildingOffice2Icon, DocumentTextIcon, HashtagIcon,
  LockClosedIcon, ReceiptPercentIcon, ShieldCheckIcon, UserGroupIcon,
} from '@heroicons/react/24/outline';

export type SectionParametres =
  | 'entreprise' | 'fiscalite' | 'documents' | 'numerotation' | 'securite'
  | 'roles' | 'utilisateurs' | 'preferences';

export interface OngletParametres {
  id: SectionParametres;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Ce que la section demande pour s'ouvrir. */
  permission: string;
  /** Ce que la section règle, en une ligne — affiché sous le titre. */
  accroche: string;
}

/**
 * Sections du menu Paramètres : sous-menu de la barre latérale **et** onglets
 * de la page (route `/parametres/<id>`). Une seule liste pour les deux, comme
 * partout ailleurs dans l'application — le menu et la page ne peuvent pas
 * diverger.
 */
export const SECTIONS_PARAMETRES: OngletParametres[] = [
  {
    id: 'entreprise', label: 'Entreprise & filiales', icon: BuildingOffice2Icon,
    permission: 'parametres.lire',
    accroche: "L'identité qui figure sur chaque pièce imprimée : raison sociale, coordonnées, logos.",
  },
  {
    id: 'fiscalite', label: 'Fiscalité & TVA', icon: ReceiptPercentIcon,
    permission: 'parametres.lire',
    accroche: 'Assujettissement, taux par défaut, mode de saisie des prix, devise et mentions légales.',
  },
  {
    id: 'documents', label: 'Documents & impressions', icon: DocumentTextIcon,
    permission: 'parametres.lire',
    accroche: 'Le format et l’allure de chaque pièce : facture, reçu, bon, journal.',
  },
  {
    id: 'numerotation', label: 'Numérotation', icon: HashtagIcon,
    permission: 'parametres.lire',
    accroche: 'Le préfixe de chaque nature de pièce, et le code de ce poste.',
  },
  {
    id: 'securite', label: 'Sécurité', icon: LockClosedIcon,
    permission: 'parametres.lire',
    accroche: 'Le code que le gérant donne pour autoriser l’annulation d’une vente.',
  },
  {
    id: 'roles', label: 'Rôles & permissions', icon: ShieldCheckIcon,
    permission: 'parametres.lire',
    accroche: 'Les rôles décident de ce que chacun peut faire.',
  },
  {
    id: 'utilisateurs', label: 'Utilisateurs', icon: UserGroupIcon,
    permission: 'parametres.lire',
    accroche: "L'affectation décide de qui porte quel rôle.",
  },
  {
    id: 'preferences', label: 'Préférences du poste', icon: AdjustmentsHorizontalIcon,
    permission: 'parametres.lire',
    accroche: 'Ce qui appartient à cette machine-ci, et ne se synchronise pas.',
  },
];

export const SECTION_PARAMETRES_DEFAUT: SectionParametres = 'entreprise';

export const estSectionParametres = (v: string | undefined): v is SectionParametres =>
  SECTIONS_PARAMETRES.some((s) => s.id === v);

export const ongletParametres = (id: SectionParametres) =>
  SECTIONS_PARAMETRES.find((s) => s.id === id) ?? SECTIONS_PARAMETRES[0]!;

export const cheminParametres = (id: SectionParametres) => `/parametres/${id}`;
