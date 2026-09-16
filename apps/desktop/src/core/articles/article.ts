import { z } from 'zod';
import type { ArticleRow } from '@quinca/shared-types';
import { margePourcent } from '../commun/prix';

export const UNITES = ['PIECE', 'KG', 'M', 'M2', 'M3', 'L', 'BIDON', 'SAC', 'CARTON', 'PAQUET', 'ROULEAU', 'BOITE'] as const;
export type Unite = (typeof UNITES)[number];

export const TVA_PAR_DEFAUT = 18;

export interface Article {
  id: string;
  code: string;
  designation: string;
  famille_id: string | null;
  sous_famille: string | null;
  prix_achat: number;
  prix_vente: number;
  prix_vip: number | null;
  tva: number;
  stock_min: number;
  stock_max: number;
  unite: string;
  image_url: string | null;
  filiale_id: string;
  est_actif: boolean;
}

const montant = (message: string) => z.coerce.number({ message }).min(0, message);

export const articleFormSchema = z
  .object({
    code: z.string().trim().min(1, 'Code obligatoire').max(30, '30 caractères max').transform((s) => s.toUpperCase()),
    designation: z.string().trim().min(1, 'Désignation obligatoire').max(120, '120 caractères max'),
    famille_id: z.string().nullable().default(null),
    sous_famille: z.string().trim().max(60).optional().default(''),
    prix_achat: montant("Prix d'achat invalide"),
    prix_vente: montant('Prix de vente invalide'),
    prix_vip: z.union([z.literal(''), z.coerce.number().min(0, 'Prix VIP invalide')]).optional().default(''),
    tva: z.coerce.number().min(0).max(100, 'TVA entre 0 et 100').default(TVA_PAR_DEFAUT),
    stock_min: montant('Stock minimum invalide').default(0),
    stock_max: montant('Stock maximum invalide').default(0),
    unite: z.enum(UNITES).default('PIECE'),
  })
  .refine((a) => a.stock_max === 0 || a.stock_max >= a.stock_min, {
    message: 'Le stock maximum doit être supérieur ou égal au minimum',
    path: ['stock_max'],
  });

export type ArticleForm = z.infer<typeof articleFormSchema>;
export type ArticleFormInput = z.input<typeof articleFormSchema>;

export function articleFromRow(row: ArticleRow): Article {
  return {
    id: row.id,
    code: row.code ?? '',
    designation: row.designation ?? '',
    famille_id: row.famille_id,
    sous_famille: row.sous_famille,
    prix_achat: row.prix_achat ?? 0,
    prix_vente: row.prix_vente ?? 0,
    prix_vip: row.prix_vip,
    tva: row.tva ?? TVA_PAR_DEFAUT,
    stock_min: row.stock_min ?? 0,
    stock_max: row.stock_max ?? 0,
    unite: row.unite ?? 'PIECE',
    image_url: row.image_url,
    filiale_id: row.filiale_id ?? '',
    est_actif: row.est_actif !== 0,
  };
}

export function articleToFormInput(article: Article): ArticleFormInput {
  return {
    code: article.code,
    designation: article.designation,
    famille_id: article.famille_id,
    sous_famille: article.sous_famille ?? '',
    prix_achat: article.prix_achat,
    prix_vente: article.prix_vente,
    prix_vip: article.prix_vip ?? '',
    tva: article.tva,
    stock_min: article.stock_min,
    stock_max: article.stock_max,
    unite: UNITES.includes(article.unite as Unite) ? (article.unite as Unite) : 'PIECE',
  };
}

export function margeArticle(article: Pick<Article, 'prix_achat' | 'prix_vente'>): number {
  return margePourcent(article.prix_achat, article.prix_vente);
}

/** Ligne d'un fichier d'import : code | désignation | prix achat | prix vente | famille. */
export interface LigneImportArticle {
  code: string;
  designation: string;
  prix_achat: number;
  prix_vente: number;
  famille_nom: string;
}

export interface ResultatImport {
  importes: number;
  ignores: Array<{ ligne: number; code: string; raison: string }>;
}

/**
 * Valide et dédoublonne les lignes d'import. Les codes déjà présents dans
 * `codesExistants` sont ignorés (pas d'écrasement silencieux du catalogue).
 */
export function preparerImport(
  lignes: LigneImportArticle[],
  codesExistants: ReadonlySet<string>,
): { valides: LigneImportArticle[]; ignores: ResultatImport['ignores'] } {
  const vus = new Set<string>();
  const valides: LigneImportArticle[] = [];
  const ignores: ResultatImport['ignores'] = [];

  lignes.forEach((ligne, index) => {
    const code = ligne.code.trim().toUpperCase();
    const numero = index + 1;
    if (!code || !ligne.designation.trim()) {
      ignores.push({ ligne: numero, code, raison: 'code ou désignation vide' });
    } else if (codesExistants.has(code)) {
      ignores.push({ ligne: numero, code, raison: 'code déjà présent dans le catalogue' });
    } else if (vus.has(code)) {
      ignores.push({ ligne: numero, code, raison: 'code en double dans le fichier' });
    } else {
      vus.add(code);
      valides.push({ ...ligne, code, designation: ligne.designation.trim() });
    }
  });

  return { valides, ignores };
}
