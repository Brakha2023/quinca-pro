import { z } from 'zod';
import type { ClientRow } from '@quinca/shared-types';

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
