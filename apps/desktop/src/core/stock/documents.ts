import { z } from 'zod';

/** Ligne d'un bon (entrée, sortie, transfert) : un article et une quantité, coût optionnel. */
export const ligneBonSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantite: z.coerce.number().positive('Quantité > 0'),
  cout_unitaire: z.union([z.literal(''), z.coerce.number().min(0)]).optional().default(''),
});
export type LigneBon = z.infer<typeof ligneBonSchema>;

const enteteBase = {
  reference: z.string().trim().max(40).optional().default(''),
  motif: z.string().trim().max(200).optional().default(''),
};

export const entreeStockSchema = z
  .object({
    depot_id: z.string().min(1, 'Dépôt obligatoire'),
    type: z.enum(['ENTREE_ACHAT', 'RETOUR_CLIENT']).default('ENTREE_ACHAT'),
    /** Fournisseur ayant livré : facultatif, et sans objet sur un retour client. */
    fournisseur_id: z.string().nullable().optional().default(null),
    ...enteteBase,
    lignes: z.array(ligneBonSchema).min(1, 'Au moins une ligne'),
  })
  // Un retour client ne vient pas d'un fournisseur : la provenance est effacée
  // plutôt que refusée, le type pouvant changer après la saisie.
  .transform((entree) => ({
    ...entree,
    fournisseur_id: entree.type === 'ENTREE_ACHAT' ? entree.fournisseur_id || null : null,
  }));
export type EntreeStock = z.infer<typeof entreeStockSchema>;

export const sortieStockSchema = z.object({
  depot_id: z.string().min(1, 'Dépôt obligatoire'),
  type: z.enum(['SORTIE_DESTOCKAGE', 'CASSE']).default('SORTIE_DESTOCKAGE'),
  ...enteteBase,
  lignes: z.array(ligneBonSchema).min(1, 'Au moins une ligne'),
});
export type SortieStock = z.infer<typeof sortieStockSchema>;

export const transfertStockSchema = z
  .object({
    depot_source_id: z.string().min(1, 'Dépôt source obligatoire'),
    depot_destination_id: z.string().min(1, 'Dépôt destination obligatoire'),
    ...enteteBase,
    lignes: z.array(ligneBonSchema).min(1, 'Au moins une ligne'),
  })
  .refine((t) => t.depot_source_id !== t.depot_destination_id, {
    message: 'Les dépôts source et destination doivent être différents',
    path: ['depot_destination_id'],
  });
export type TransfertStock = z.infer<typeof transfertStockSchema>;

export const ligneInventaireSchema = z.object({
  article_id: z.string().min(1),
  quantite_comptee: z.coerce.number().min(0, 'Quantité ≥ 0'),
});

export const inventaireSchema = z.object({
  depot_id: z.string().min(1, 'Dépôt obligatoire'),
  ...enteteBase,
  lignes: z.array(ligneInventaireSchema).min(1, 'Au moins une ligne'),
});
export type Inventaire = z.infer<typeof inventaireSchema>;

/** Fusionne les lignes portant le même article (saisie en plusieurs fois). */
export function fusionnerLignes<L extends { article_id: string; quantite: number }>(lignes: L[]): L[] {
  const parArticle = new Map<string, L>();
  for (const ligne of lignes) {
    const existante = parArticle.get(ligne.article_id);
    parArticle.set(ligne.article_id, existante ? { ...existante, quantite: existante.quantite + ligne.quantite } : { ...ligne });
  }
  return [...parArticle.values()];
}
