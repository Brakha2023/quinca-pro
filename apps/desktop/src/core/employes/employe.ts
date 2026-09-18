import { z } from 'zod';
import { SEXES, STATUTS_POINTAGE, TYPES_CONTRAT, TYPES_REGLEMENT, type EmployeRow, type PaieRow, type PointageRow, type Sexe, type StatutPaie, type StatutPointage, type TypeContrat } from '@quinca/shared-types';
import { arrondirFcfa } from '../commun/prix';

export const LIBELLES_TYPE_CONTRAT: Record<TypeContrat, string> = { CDI: 'CDI', CDD: 'CDD', STAGE: 'Stage', JOURNALIER: 'Journalier', PRESTATAIRE: 'Prestataire' };
export const LIBELLES_SEXE: Record<Sexe, string> = { M: 'Homme', F: 'Femme' };
export const LIBELLES_STATUT_POINTAGE: Record<StatutPointage, string> = { PRESENT: 'Présent', ABSENT: 'Absent', JUSTIFIE: 'Absence justifiée' };
export const LIBELLES_STATUT_PAIE: Record<StatutPaie, string> = { CALCULEE: 'À payer', PAYEE: 'Payée' };

/** Pièces jointes stockées en base (data URL) pour rester disponibles hors ligne : tailles plafonnées. */
export const TAILLE_MAX_PHOTO = 300 * 1024;
export const TAILLE_MAX_CONTRAT = 1024 * 1024;
export const TYPES_CONTRAT_FICHIER = ['application/pdf', 'image/jpeg', 'image/png'];

export interface Employe {
  id: string;
  matricule: string;
  nom: string;
  prenom: string | null;
  sexe: Sexe | null;
  telephone: string | null;
  fonction: string | null;
  date_debut: string | null;
  date_fin: string | null;
  type_contrat: TypeContrat;
  salaire_base: number;
  est_actif: boolean;
  photo: string | null;
  contrat_nom: string | null;
  contrat_fichier: string | null;
  notes: string | null;
  filiale_id: string;
}

export const employeFormSchema = z.object({
  matricule: z.string().trim().max(20).transform((s) => s.toUpperCase()).optional().default(''),
  nom: z.string().trim().min(1, 'Nom obligatoire').max(80),
  prenom: z.string().trim().max(80).optional().default(''),
  sexe: z.union([z.literal(''), z.enum(SEXES)]).optional().default(''),
  telephone: z.string().trim().max(30).optional().default(''),
  fonction: z.string().trim().max(80).optional().default(''),
  date_debut: z.string().optional().default(''),
  date_fin: z.string().optional().default(''),
  type_contrat: z.enum(TYPES_CONTRAT).default('CDI'),
  salaire_base: z.coerce.number().min(0, 'Salaire ≥ 0').default(0),
  est_actif: z.boolean().default(true),
  photo: z.string().max(TAILLE_MAX_PHOTO * 1.4, 'Photo trop lourde').nullable().optional().default(null),
  contrat_nom: z.string().max(120).nullable().optional().default(null),
  contrat_fichier: z.string().max(TAILLE_MAX_CONTRAT * 1.4, 'Contrat trop lourd (1 Mo max)').nullable().optional().default(null),
  notes: z.string().trim().max(500).optional().default(''),
});
export type EmployeForm = z.infer<typeof employeFormSchema>;
export type EmployeFormInput = z.input<typeof employeFormSchema>;

export function employeFromRow(row: EmployeRow): Employe {
  return {
    id: row.id, matricule: row.matricule ?? '', nom: row.nom ?? '', prenom: row.prenom, sexe: (row.sexe as Sexe | null) ?? null, telephone: row.telephone, fonction: row.fonction,
    date_debut: row.date_debut, date_fin: row.date_fin, type_contrat: (row.type_contrat ?? 'CDI') as TypeContrat, salaire_base: row.salaire_base ?? 0, est_actif: row.est_actif !== 0,
    photo: row.photo, contrat_nom: row.contrat_nom, contrat_fichier: row.contrat_fichier, notes: row.notes, filiale_id: row.filiale_id ?? '',
  };
}

export function employeToFormInput(e: Employe): EmployeFormInput {
  return {
    matricule: e.matricule, nom: e.nom, prenom: e.prenom ?? '', sexe: e.sexe ?? '', telephone: e.telephone ?? '', fonction: e.fonction ?? '', date_debut: e.date_debut ?? '',
    date_fin: e.date_fin ?? '', type_contrat: e.type_contrat, salaire_base: e.salaire_base, est_actif: e.est_actif, photo: e.photo, contrat_nom: e.contrat_nom, contrat_fichier: e.contrat_fichier, notes: e.notes ?? '',
  };
}

export const nomComplet = (e: Pick<Employe, 'nom' | 'prenom'>) => `${e.prenom ?? ''} ${e.nom}`.trim();

export const pointageSchema = z.object({
  employe_id: z.string().min(1),
  date_pointage: z.string().min(1, 'Date obligatoire'),
  statut: z.enum(STATUTS_POINTAGE),
  commentaire: z.string().trim().max(200).optional().default(''),
});
export type PointageForm = z.infer<typeof pointageSchema>;

export interface Pointage {
  id: string;
  employe_id: string;
  date_pointage: string;
  statut: StatutPointage;
  commentaire: string | null;
}

export function pointageFromRow(row: PointageRow): Pointage {
  return { id: row.id, employe_id: row.employe_id ?? '', date_pointage: row.date_pointage ?? '', statut: (row.statut ?? 'PRESENT') as StatutPointage, commentaire: row.commentaire };
}

export const avanceSalaireSchema = z.object({
  employe_id: z.string().min(1, 'Employé obligatoire'),
  periode: z.string().regex(/^\d{4}-\d{2}$/, 'Mois de paie obligatoire'),
  montant: z.coerce.number().positive('Montant > 0'),
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  notes: z.string().trim().max(200).optional().default(''),
});
export type AvanceSalaireForm = z.infer<typeof avanceSalaireSchema>;
export type AvanceSalaireFormInput = z.input<typeof avanceSalaireSchema>;

/** Jours ouvrés retenus par mois pour valoriser une journée d'absence (convention). */
export const JOURS_OUVRES_MOIS = 26;

export interface BasePaie {
  type_contrat: TypeContrat;
  salaire_base: number;
  jours_presents: number;
  jours_absents: number;
  jours_justifies: number;
  primes: number;
  retenues: number;
  avances: number;
}

export interface PaieCalculee {
  retenue_absences: number;
  brut: number;
  net_a_payer: number;
}

/**
 * Calcul d'une paie mensuelle.
 * - Journalier : brut = taux journalier × jours présents.
 * - Autres contrats : brut = salaire de base − 1/26 par jour d'absence non justifiée.
 * - Net = brut + primes − retenues − avances déjà versées (jamais négatif).
 */
export function calculerPaie(b: BasePaie): PaieCalculee {
  let brut: number;
  let retenue_absences = 0;
  if (b.type_contrat === 'JOURNALIER') {
    brut = arrondirFcfa(b.salaire_base * b.jours_presents);
  } else {
    retenue_absences = arrondirFcfa((b.salaire_base / JOURS_OUVRES_MOIS) * b.jours_absents);
    brut = arrondirFcfa(b.salaire_base - retenue_absences);
  }
  const net_a_payer = Math.max(arrondirFcfa(brut + b.primes - b.retenues - b.avances), 0);
  return { retenue_absences, brut, net_a_payer };
}

export const paiementPaieSchema = z.object({
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  mode_paiement: z.enum(TYPES_REGLEMENT).default('ESPECES'),
  reference: z.string().trim().max(60).optional().default(''),
});
export type PaiementPaieForm = z.infer<typeof paiementPaieSchema>;
export type PaiementPaieFormInput = z.input<typeof paiementPaieSchema>;

export interface Paie {
  id: string;
  employe_id: string;
  periode: string;
  salaire_base: number;
  jours_presents: number;
  jours_absents: number;
  jours_justifies: number;
  retenue_absences: number;
  primes: number;
  retenues: number;
  avances: number;
  brut: number;
  net_a_payer: number;
  statut: StatutPaie;
  date_paiement: string | null;
  caisse_id: string | null;
  mode_paiement: string | null;
  reference: string | null;
  notes: string | null;
}

export function paieFromRow(row: PaieRow): Paie {
  return {
    id: row.id, employe_id: row.employe_id ?? '', periode: row.periode ?? '', salaire_base: row.salaire_base ?? 0, jours_presents: row.jours_presents ?? 0, jours_absents: row.jours_absents ?? 0,
    jours_justifies: row.jours_justifies ?? 0, retenue_absences: row.retenue_absences ?? 0, primes: row.primes ?? 0, retenues: row.retenues ?? 0, avances: row.avances ?? 0, brut: row.brut ?? 0,
    net_a_payer: row.net_a_payer ?? 0, statut: (row.statut ?? 'CALCULEE') as StatutPaie, date_paiement: row.date_paiement, caisse_id: row.caisse_id, mode_paiement: row.mode_paiement,
    reference: row.reference, notes: row.notes,
  };
}

/** Mois courant au format AAAA-MM. */
export const periodeCourante = (d: Date = new Date()) => d.toISOString().slice(0, 7);

export function libellePeriode(periode: string): string {
  const [a, m] = periode.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}
