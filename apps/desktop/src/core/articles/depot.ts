import { z } from 'zod';
import type { DepotRow } from '@quinca/shared-types';

export interface Depot {
  id: string;
  code: string;
  nom: string;
  adresse: string | null;
  responsable: string | null;
  filiale_id: string;
  est_actif: boolean;
}

export const depotFormSchema = z.object({
  code: z.string().trim().min(1, 'Code obligatoire').max(10).transform((s) => s.toUpperCase()),
  nom: z.string().trim().min(1, 'Nom obligatoire').max(60),
  adresse: z.string().trim().max(200).optional().default(''),
  responsable: z.string().trim().max(60).optional().default(''),
});
export type DepotForm = z.infer<typeof depotFormSchema>;
export type DepotFormInput = z.input<typeof depotFormSchema>;

export function depotFromRow(row: DepotRow): Depot {
  return {
    id: row.id,
    code: row.code ?? '',
    nom: row.nom ?? '',
    adresse: row.adresse,
    responsable: row.responsable,
    filiale_id: row.filiale_id ?? '',
    est_actif: row.est_actif !== 0,
  };
}
