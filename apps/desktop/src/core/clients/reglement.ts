import { z } from 'zod';
import { TYPES_REGLEMENT, type ReglementClientRow, type TypeReglement } from '@quinca/shared-types';

export interface ReglementClient {
  id: string;
  numero: string;
  client_id: string;
  vente_id: string | null;
  date_reglement: string;
  montant: number;
  type_reglement: TypeReglement;
  reference: string | null;
  caisse_id: string | null;
  utilisateur_id: string | null;
  filiale_id: string;
}

export const reglementFormSchema = z.object({
  montant: z.coerce.number().positive('Montant > 0'),
  type_reglement: z.enum(TYPES_REGLEMENT).default('ESPECES'),
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  reference: z.string().trim().max(60).optional().default(''),
  date_reglement: z.string().optional().default(''),
});
export type ReglementForm = z.infer<typeof reglementFormSchema>;
export type ReglementFormInput = z.input<typeof reglementFormSchema>;

export const LIBELLES_TYPE_REGLEMENT: Record<TypeReglement, string> = {
  ESPECES: 'Espèces',
  CHEQUE: 'Chèque',
  VIREMENT: 'Virement',
  MOBILE_MONEY: 'Mobile money',
};

/** Modes de règlement qui alimentent physiquement une caisse (les autres vont en banque). */
export const TYPES_EN_CAISSE: ReadonlySet<TypeReglement> = new Set(['ESPECES', 'MOBILE_MONEY']);

export function reglementFromRow(row: ReglementClientRow): ReglementClient {
  return {
    id: row.id,
    numero: row.numero ?? '',
    client_id: row.client_id ?? '',
    vente_id: row.vente_id,
    date_reglement: row.date_reglement ?? '',
    montant: row.montant ?? 0,
    type_reglement: (row.type_reglement ?? 'ESPECES') as TypeReglement,
    reference: row.reference,
    caisse_id: row.caisse_id,
    utilisateur_id: row.utilisateur_id,
    filiale_id: row.filiale_id ?? '',
  };
}
