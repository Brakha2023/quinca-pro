import { z } from 'zod';
import { TYPES_REGLEMENT, type CommandeFournisseurRow, type FournisseurRow, type ReglementFournisseurRow, type StatutCommandeFournisseur, type TypeReglement } from '@quinca/shared-types';
import { ligneBonSchema } from '../stock';

export interface Fournisseur {
  id: string;
  code: string;
  numero_compte: string | null;
  raison_sociale: string;
  famille: string | null;
  type_article: string | null;
  telephone: string | null;
  email: string | null;
  adresse: string | null;
  solde_initial: number;
  cumul_factures: number;
  cumul_reglements: number;
  /** Dette actuelle : positif = nous devons, négatif = avoir chez le fournisseur. */
  solde_actuel: number;
  plafond_credit: number;
  filiale_id: string;
  est_actif: boolean;
}

export const fournisseurFormSchema = z.object({
  code: z.string().trim().max(20).transform((s) => s.toUpperCase()).optional().default(''),
  raison_sociale: z.string().trim().min(1, 'Raison sociale obligatoire').max(120),
  numero_compte: z.string().trim().max(30).optional().default(''),
  famille: z.string().trim().max(60).optional().default(''),
  type_article: z.string().trim().max(60).optional().default(''),
  telephone: z.string().trim().max(30).optional().default(''),
  email: z.union([z.literal(''), z.string().trim().email('Email invalide')]).optional().default(''),
  adresse: z.string().trim().max(200).optional().default(''),
  solde_initial: z.coerce.number().default(0),
  plafond_credit: z.coerce.number().min(0).default(0),
});
export type FournisseurForm = z.infer<typeof fournisseurFormSchema>;
export type FournisseurFormInput = z.input<typeof fournisseurFormSchema>;

export function fournisseurFromRow(row: FournisseurRow): Fournisseur {
  return {
    id: row.id,
    code: row.code ?? '',
    numero_compte: row.numero_compte,
    raison_sociale: row.raison_sociale ?? '',
    famille: row.famille,
    type_article: row.type_article,
    telephone: row.telephone,
    email: row.email,
    adresse: row.adresse,
    solde_initial: row.solde_initial ?? 0,
    cumul_factures: row.cumul_factures ?? 0,
    cumul_reglements: row.cumul_reglements ?? 0,
    solde_actuel: row.solde_actuel ?? 0,
    plafond_credit: row.plafond_credit ?? 0,
    filiale_id: row.filiale_id ?? '',
    est_actif: row.est_actif !== 0,
  };
}

export function fournisseurToFormInput(f: Fournisseur): FournisseurFormInput {
  return {
    code: f.code, raison_sociale: f.raison_sociale, numero_compte: f.numero_compte ?? '', famille: f.famille ?? '', type_article: f.type_article ?? '',
    telephone: f.telephone ?? '', email: f.email ?? '', adresse: f.adresse ?? '', solde_initial: f.solde_initial, plafond_credit: f.plafond_credit,
  };
}

export function calculerDette(f: Pick<Fournisseur, 'solde_initial' | 'cumul_factures' | 'cumul_reglements'>): number {
  return Math.round((f.solde_initial + f.cumul_factures - f.cumul_reglements) * 100) / 100;
}

/**
 * Achat saisi à la réception (BL / facture fournisseur) : les lignes entrent
 * en stock au coût saisi, le total devient une dette fournisseur, et un
 * acompte peut être payé immédiatement.
 */
export const achatSchema = z.object({
  fournisseur_id: z.string().min(1, 'Fournisseur obligatoire'),
  depot_id: z.string().min(1, 'Dépôt obligatoire'),
  reference: z.string().trim().max(40).optional().default(''),
  notes: z.string().trim().max(200).optional().default(''),
  tva_percent: z.coerce.number().min(0).max(100).default(0),
  lignes: z
    .array(
      ligneBonSchema.extend({
        cout_unitaire: z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number({ message: 'Coût unitaire obligatoire' }).min(0, 'Coût ≥ 0')),
      }),
    )
    .min(1, 'Au moins une ligne'),
});
export type Achat = z.infer<typeof achatSchema>;

export function totauxAchat(achat: Pick<Achat, 'lignes' | 'tva_percent'>) {
  const total_ht = Math.round(achat.lignes.reduce((s, l) => s + l.quantite * l.cout_unitaire, 0) * 100) / 100;
  const total_tva = Math.round(total_ht * (achat.tva_percent / 100) * 100) / 100;
  return { total_ht, total_tva, total_ttc: Math.round((total_ht + total_tva) * 100) / 100 };
}

export const reglementFournisseurSchema = z.object({
  montant: z.coerce.number().positive('Montant > 0'),
  type_reglement: z.enum(TYPES_REGLEMENT).default('ESPECES'),
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  reference: z.string().trim().max(60).optional().default(''),
  commande_id: z.string().optional().default(''),
});
export type ReglementFournisseurForm = z.infer<typeof reglementFournisseurSchema>;
export type ReglementFournisseurFormInput = z.input<typeof reglementFournisseurSchema>;

export const LIBELLES_STATUT_COMMANDE: Record<StatutCommandeFournisseur, string> = {
  BROUILLON: 'Brouillon', ENVOYEE: 'Envoyée', PARTIELLE: 'Partielle', LIVREE: 'Livrée', ANNULEE: 'Annulée',
};

export interface CommandeFournisseur {
  id: string;
  numero: string;
  fournisseur_id: string;
  date_commande: string;
  statut: StatutCommandeFournisseur;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  montant_paye: number;
  reste_a_payer: number;
  notes: string | null;
}

export function commandeFromRow(row: CommandeFournisseurRow): CommandeFournisseur {
  return {
    id: row.id, numero: row.numero ?? '', fournisseur_id: row.fournisseur_id ?? '', date_commande: row.date_commande ?? '',
    statut: (row.statut ?? 'LIVREE') as StatutCommandeFournisseur, total_ht: row.total_ht ?? 0, total_tva: row.total_tva ?? 0,
    total_ttc: row.total_ttc ?? 0, montant_paye: row.montant_paye ?? 0, reste_a_payer: row.reste_a_payer ?? 0, notes: row.notes,
  };
}

export interface ReglementFournisseur {
  id: string;
  numero: string;
  fournisseur_id: string;
  commande_id: string | null;
  date_reglement: string;
  montant: number;
  type_reglement: TypeReglement;
  reference: string | null;
  caisse_id: string | null;
}

export function reglementFournisseurFromRow(row: ReglementFournisseurRow): ReglementFournisseur {
  return {
    id: row.id, numero: row.numero ?? '', fournisseur_id: row.fournisseur_id ?? '', commande_id: row.commande_id, date_reglement: row.date_reglement ?? '',
    montant: row.montant ?? 0, type_reglement: (row.type_reglement ?? 'ESPECES') as TypeReglement, reference: row.reference, caisse_id: row.caisse_id,
  };
}
