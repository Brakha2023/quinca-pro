import { z } from 'zod';
import type { CaisseRow, MouvementTresorerieRow, TypeMouvementTresorerie } from '@quinca/shared-types';

export interface Caisse {
  id: string;
  code: string;
  nom: string;
  responsable: string | null;
  solde_actuel: number;
  filiale_id: string;
  est_active: boolean;
}

export const caisseFormSchema = z.object({
  code: z.string().trim().min(1, 'Code obligatoire').max(10).transform((s) => s.toUpperCase()),
  nom: z.string().trim().min(1, 'Nom obligatoire').max(60),
  responsable: z.string().trim().max(60).optional().default(''),
});
export type CaisseForm = z.infer<typeof caisseFormSchema>;
export type CaisseFormInput = z.input<typeof caisseFormSchema>;

export function caisseFromRow(row: CaisseRow): Caisse {
  return { id: row.id, code: row.code ?? '', nom: row.nom ?? '', responsable: row.responsable, solde_actuel: row.solde_actuel ?? 0, filiale_id: row.filiale_id ?? '', est_active: row.est_active !== 0 };
}

/** Catégories saisissables à la main ; les autres (VENTE, REGLEMENT_*…) sont générées par les modules métier. */
export const CATEGORIES_RECETTE = ['APPORT', 'REMBOURSEMENT', 'AUTRE_RECETTE'] as const;
export const CATEGORIES_DEPENSE = ['TRANSPORT', 'FOURNITURES', 'LOYER', 'SALAIRE', 'ELECTRICITE_EAU', 'ENTRETIEN', 'REPAS', 'AUTRE_DEPENSE'] as const;

export const LIBELLES_CATEGORIE: Record<string, string> = {
  VENTE: 'Vente', REGLEMENT_CLIENT: 'Règlement client', ANNULATION_VENTE: 'Annulation de vente', REGLEMENT_FOURNISSEUR: 'Règlement fournisseur',
  TRANSFERT_CAISSE: 'Transfert entre caisses', AVANCE_SALAIRE: 'Avance sur salaire', APPORT: 'Apport de fonds', REMBOURSEMENT: 'Remboursement', AUTRE_RECETTE: 'Autre recette',
  TRANSPORT: 'Transport', FOURNITURES: 'Fournitures', LOYER: 'Loyer', SALAIRE: 'Salaires', ELECTRICITE_EAU: 'Électricité / eau', ENTRETIEN: 'Entretien', REPAS: 'Repas', AUTRE_DEPENSE: 'Autre dépense',
};

export const operationSchema = z.object({
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  type: z.enum(['RECETTE', 'DEPENSE']),
  categorie: z.string().min(1, 'Catégorie obligatoire'),
  montant: z.coerce.number().positive('Montant > 0'),
  description: z.string().trim().max(200).optional().default(''),
  reference: z.string().trim().max(60).optional().default(''),
});
export type OperationForm = z.infer<typeof operationSchema>;
export type OperationFormInput = z.input<typeof operationSchema>;

export const transfertCaisseSchema = z
  .object({
    caisse_source_id: z.string().min(1, 'Caisse source obligatoire'),
    caisse_destination_id: z.string().min(1, 'Caisse destination obligatoire'),
    montant: z.coerce.number().positive('Montant > 0'),
    motif: z.string().trim().max(200).optional().default(''),
  })
  .refine((t) => t.caisse_source_id !== t.caisse_destination_id, { message: 'Les deux caisses doivent être différentes', path: ['caisse_destination_id'] });
export type TransfertCaisseForm = z.infer<typeof transfertCaisseSchema>;
export type TransfertCaisseFormInput = z.input<typeof transfertCaisseSchema>;

export interface MouvementTresorerie {
  id: string;
  type: TypeMouvementTresorerie;
  categorie: string;
  montant: number;
  description: string | null;
  reference: string | null;
  caisse_id: string;
  utilisateur_id: string | null;
  date_operation: string;
}

export function mouvementTresorerieFromRow(row: MouvementTresorerieRow): MouvementTresorerie {
  return {
    id: row.id, type: (row.type ?? 'RECETTE') as TypeMouvementTresorerie, categorie: row.categorie ?? '', montant: row.montant ?? 0, description: row.description,
    reference: row.reference, caisse_id: row.caisse_id ?? '', utilisateur_id: row.utilisateur_id, date_operation: row.date_operation ?? '',
  };
}
