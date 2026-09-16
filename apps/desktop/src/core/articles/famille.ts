import { z } from 'zod';
import type { FamilleArticleRow } from '@quinca/shared-types';

export interface FamilleArticle {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  filiale_id: string;
  est_active: boolean;
}

export const familleFormSchema = z.object({
  code: z.string().trim().min(1, 'Code obligatoire').max(10, '10 caractères max').transform((s) => s.toUpperCase()),
  nom: z.string().trim().min(1, 'Nom obligatoire').max(60).transform((s) => s.toUpperCase()),
  description: z.string().trim().max(200).optional().default(''),
});
export type FamilleForm = z.infer<typeof familleFormSchema>;
export type FamilleFormInput = z.input<typeof familleFormSchema>;

export function familleFromRow(row: FamilleArticleRow): FamilleArticle {
  return {
    id: row.id,
    code: row.code ?? '',
    nom: row.nom ?? '',
    description: row.description,
    filiale_id: row.filiale_id ?? '',
    est_active: row.est_active !== 0,
  };
}
