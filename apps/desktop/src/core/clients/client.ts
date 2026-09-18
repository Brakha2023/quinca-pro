import { z } from 'zod';
import type { ClientRow } from '@quinca/shared-types';

export const PERIODES_REGLEMENT_CLIENT = ['COMPTANT', 'J15', 'J30', 'J45', 'J60', 'FIN_DE_MOIS'] as const;
export type PeriodeReglementClient = (typeof PERIODES_REGLEMENT_CLIENT)[number];
export const LIBELLES_PERIODE_REGLEMENT_CLIENT: Record<PeriodeReglementClient, string> = {
  COMPTANT: 'Comptant', J15: '15 jours', J30: '30 jours', J45: '45 jours', J60: '60 jours', FIN_DE_MOIS: 'Fin de mois',
};
/** Délai de paiement en jours ; fin de mois = 30 par convention. */
export const JOURS_PERIODE_REGLEMENT: Record<PeriodeReglementClient, number> = { COMPTANT: 0, J15: 15, J30: 30, J45: 45, J60: 60, FIN_DE_MOIS: 30 };
export const CIVILITES = ['M.', 'Mme', 'Mlle', 'Sté'] as const;

export interface Client {
  id: string;
  code: string;
  raison_sociale: string;
  mobile: string | null;
  email: string | null;
  adresse: string | null;
  contact: string | null;
  solde_initial: number;
  cumul_factures: number;
  cumul_reglements: number;
  /** Créance actuelle : positif = le client doit, négatif = avoir (acompte). */
  solde_actuel: number;
  plafond_credit: number;
  filiale_id: string;
  est_actif: boolean;
  groupe: string | null;
  civilite: string | null;
  numero_compte: string | null;
  telephone: string | null;
  pays: string | null;
  ville: string | null;
  numero_rc: string | null;
  numero_cc: string | null;
  date_effet_solde: string | null;
  /** Remise commerciale appliquée d'office à ses tickets (%). */
  remise_percent: number;
  prise_min_jour: number;
  prise_max_jour: number;
  periode_reglement: PeriodeReglementClient | null;
  notes: string | null;
}

export const clientFormSchema = z.object({
  code: z.string().trim().max(20, '20 caractères max').transform((s) => s.toUpperCase()).optional().default(''),
  raison_sociale: z.string().trim().min(1, 'Raison sociale obligatoire').max(120),
  mobile: z.string().trim().max(30).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().email('Email invalide')]).optional().default(''),
  adresse: z.string().trim().max(200).optional().default(''),
  contact: z.string().trim().max(80).optional().default(''),
  solde_initial: z.coerce.number().default(0),
  plafond_credit: z.coerce.number().min(0, 'Plafond ≥ 0').default(0),
  groupe: z.string().trim().max(60).optional().default(''),
  civilite: z.string().trim().max(10).optional().default(''),
  numero_compte: z.string().trim().max(30).optional().default(''),
  telephone: z.string().trim().max(30).optional().default(''),
  pays: z.string().trim().max(60).optional().default(''),
  ville: z.string().trim().max(60).optional().default(''),
  numero_rc: z.string().trim().max(40).optional().default(''),
  numero_cc: z.string().trim().max(40).optional().default(''),
  date_effet_solde: z.string().optional().default(''),
  remise_percent: z.coerce.number().min(0, '0 à 100 %').max(100, '0 à 100 %').default(0),
  prise_min_jour: z.coerce.number().min(0).default(0),
  prise_max_jour: z.coerce.number().min(0).default(0),
  periode_reglement: z.union([z.literal(''), z.enum(PERIODES_REGLEMENT_CLIENT)]).optional().default(''),
  notes: z.string().trim().max(500).optional().default(''),
});
export type ClientForm = z.infer<typeof clientFormSchema>;
export type ClientFormInput = z.input<typeof clientFormSchema>;

export function clientFromRow(row: ClientRow): Client {
  return {
    id: row.id,
    code: row.code ?? '',
    raison_sociale: row.raison_sociale ?? '',
    mobile: row.mobile,
    email: row.email,
    adresse: row.adresse,
    contact: row.contact,
    solde_initial: row.solde_initial ?? 0,
    cumul_factures: row.cumul_factures ?? 0,
    cumul_reglements: row.cumul_reglements ?? 0,
    solde_actuel: row.solde_actuel ?? 0,
    plafond_credit: row.plafond_credit ?? 0,
    filiale_id: row.filiale_id ?? '',
    est_actif: row.est_actif !== 0,
    groupe: row.groupe, civilite: row.civilite, numero_compte: row.numero_compte, telephone: row.telephone, pays: row.pays, ville: row.ville,
    numero_rc: row.numero_rc, numero_cc: row.numero_cc, date_effet_solde: row.date_effet_solde, remise_percent: row.remise_percent ?? 0,
    prise_min_jour: row.prise_min_jour ?? 0, prise_max_jour: row.prise_max_jour ?? 0,
    periode_reglement: (row.periode_reglement as PeriodeReglementClient | null) ?? null, notes: row.notes,
  };
}

export function clientToFormInput(c: Client): ClientFormInput {
  return {
    code: c.code,
    raison_sociale: c.raison_sociale,
    mobile: c.mobile ?? '',
    email: c.email ?? '',
    adresse: c.adresse ?? '',
    contact: c.contact ?? '',
    solde_initial: c.solde_initial,
    plafond_credit: c.plafond_credit,
    groupe: c.groupe ?? '', civilite: c.civilite ?? '', numero_compte: c.numero_compte ?? '', telephone: c.telephone ?? '', pays: c.pays ?? '', ville: c.ville ?? '',
    numero_rc: c.numero_rc ?? '', numero_cc: c.numero_cc ?? '', date_effet_solde: c.date_effet_solde ?? '', remise_percent: c.remise_percent,
    prise_min_jour: c.prise_min_jour, prise_max_jour: c.prise_max_jour, periode_reglement: c.periode_reglement ?? '', notes: c.notes ?? '',
  };
}

/** Solde = ouverture + factures − règlements. Toujours recalculé à partir des cumuls. */
export function calculerSolde(c: Pick<Client, 'solde_initial' | 'cumul_factures' | 'cumul_reglements'>): number {
  return Math.round((c.solde_initial + c.cumul_factures - c.cumul_reglements) * 100) / 100;
}

/** Crédit encore mobilisable : plafond − créance (jamais négatif). */
export function disponibiliteCredit(c: Pick<Client, 'plafond_credit' | 'solde_actuel'>): number {
  return Math.max(c.plafond_credit - c.solde_actuel, 0);
}

export type StatutCredit = 'A_JOUR' | 'AVOIR' | 'EN_COURS' | 'DEPASSE';

export function statutCredit(c: Pick<Client, 'plafond_credit' | 'solde_actuel'>): StatutCredit {
  if (c.solde_actuel < 0) return 'AVOIR';
  if (c.solde_actuel === 0) return 'A_JOUR';
  if (c.solde_actuel > c.plafond_credit) return 'DEPASSE';
  return 'EN_COURS';
}

/**
 * Une vente à crédit est autorisée si, après la vente, la créance reste
 * dans le plafond. Un plafond à 0 interdit tout crédit.
 */
export function peutVendreACredit(c: Pick<Client, 'plafond_credit' | 'solde_actuel'>, montant: number): boolean {
  return c.solde_actuel + montant <= c.plafond_credit;
}
