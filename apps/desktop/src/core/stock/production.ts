import { z } from 'zod';
import type { LigneProductionRow, ProductionRow, SensLigneProduction } from '@quinca/shared-types';
import { arrondirMontant } from '../commun/prix';

/**
 * Production : des matières premières sortent du stock, des articles produits
 * y entrent. Le coût des matières (au coût moyen du dépôt) devient le coût de
 * revient des produits ; les pertes sont supportées par les unités bonnes.
 */
export const ligneMatiereSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantite: z.coerce.number().positive('Quantité consommée > 0'),
});

export const ligneProduitSchema = z.object({
  article_id: z.string().min(1, 'Article obligatoire'),
  quantite_prevue: z.coerce.number().min(0, 'Quantité prévue ≥ 0').default(0),
  quantite: z.coerce.number().min(0, 'Quantité produite ≥ 0'),
  pertes: z.coerce.number().min(0, 'Pertes ≥ 0').default(0),
});

export const productionSchema = z
  .object({
    depot_id: z.string().min(1, 'Dépôt obligatoire'),
    numero: z.string().trim().max(40).optional().default(''),
    equipe: z.string().trim().max(60).optional().default(''),
    date_debut: z.string().min(1, 'Date de début obligatoire'),
    date_fin: z.string().optional().default(''),
    commentaire: z.string().trim().max(500).optional().default(''),
    matieres: z.array(ligneMatiereSchema).min(1, 'Au moins une matière première'),
    produits: z.array(ligneProduitSchema).min(1, 'Au moins un article produit'),
  })
  .refine((p) => p.produits.some((l) => l.quantite > 0), { message: 'Aucune quantité produite', path: ['produits'] })
  .refine((p) => !p.date_fin || p.date_fin >= p.date_debut, { message: 'La fin doit être après le début', path: ['date_fin'] })
  .refine((p) => !p.produits.some((pr) => p.matieres.some((m) => m.article_id === pr.article_id)), {
    message: 'Un article ne peut pas être à la fois matière première et produit',
    path: ['produits'],
  });
export type ProductionForm = z.infer<typeof productionSchema>;

export interface ProduitAValoriser {
  article_id: string;
  /** Quantité bonne (entrant en stock). */
  quantite: number;
  /** Prix d'achat de référence de l'article, 0 si inconnu. */
  prix_achat: number;
}

/**
 * Coût de revient unitaire de chaque produit à partir du coût total des
 * matières consommées : réparti au prorata de la valeur (quantité × prix
 * d'achat de référence) si tous les produits en ont un, sinon au prorata des
 * quantités. Les produits sans quantité bonne ne reçoivent rien (leur part
 * est absorbée par les autres : les pertes coûtent).
 */
export function repartirCoutProduction(coutMatieres: number, produits: ProduitAValoriser[]): Map<string, number> {
  const bons = produits.filter((p) => p.quantite > 0);
  const parValeur = bons.length > 0 && bons.every((p) => p.prix_achat > 0);
  const poids = (p: ProduitAValoriser) => (parValeur ? p.quantite * p.prix_achat : p.quantite);
  const total = bons.reduce((s, p) => s + poids(p), 0);
  const couts = new Map<string, number>();
  for (const p of bons) {
    couts.set(p.article_id, total > 0 ? arrondirMontant((coutMatieres * poids(p)) / total / p.quantite) : 0);
  }
  return couts;
}

/** Écart entre produit et prévu (négatif = moins que prévu). */
export function ecartProduction(quantitePrevue: number, quantite: number): number {
  return quantite - quantitePrevue;
}

export interface Production {
  id: string;
  numero: string;
  depot_id: string;
  filiale_id: string;
  equipe: string | null;
  date_debut: string;
  date_fin: string | null;
  cout_matieres: number;
  commentaire: string | null;
  utilisateur_id: string | null;
}

export function productionFromRow(row: ProductionRow): Production {
  return {
    id: row.id, numero: row.numero ?? '', depot_id: row.depot_id ?? '', filiale_id: row.filiale_id ?? '', equipe: row.equipe,
    date_debut: row.date_debut ?? '', date_fin: row.date_fin, cout_matieres: row.cout_matieres ?? 0, commentaire: row.commentaire, utilisateur_id: row.utilisateur_id,
  };
}

export interface LigneProduction {
  id: string;
  production_id: string;
  sens: SensLigneProduction;
  article_id: string;
  code_article: string;
  designation: string;
  unite: string;
  quantite_prevue: number;
  quantite: number;
  pertes: number;
  cout_unitaire: number | null;
}

export function ligneProductionFromRow(row: LigneProductionRow): LigneProduction {
  return {
    id: row.id, production_id: row.production_id ?? '', sens: (row.sens ?? 'MATIERE') as SensLigneProduction, article_id: row.article_id ?? '',
    code_article: row.code_article ?? '', designation: row.designation ?? '', unite: row.unite ?? '', quantite_prevue: row.quantite_prevue ?? 0,
    quantite: row.quantite ?? 0, pertes: row.pertes ?? 0, cout_unitaire: row.cout_unitaire,
  };
}
