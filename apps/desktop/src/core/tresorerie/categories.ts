import { z } from 'zod';
import { TYPES_MOUVEMENT_TRESORERIE, type CategorieTresorerieRow, type TypeMouvementTresorerie } from '@quinca/shared-types';
import {
  CATEGORIES_DEPENSE, CATEGORIES_RECETTE, CATEGORIE_RETRAIT, CATEGORIE_TRANSFERT_FILIALE, CATEGORIE_VERSEMENT, LIBELLES_CATEGORIE,
} from './tresorerie';

/**
 * Catégories de trésorerie, intégrées et ajoutées.
 *
 * Une quincaillerie paie des choses que l'application ne pouvait pas prévoir :
 * un gardiennage, une patente, un dédouanement. Faute de pouvoir les nommer,
 * tout finissait dans « Autre dépense » — et l'état des dépenses par catégorie
 * ne disait plus rien. La filiale ajoute donc les siennes.
 *
 * Trois familles de codes, qui ne se mélangent pas :
 *
 *   * **intégrées** — TRANSPORT, LOYER, APPORT… : dans le code, toujours là,
 *     jamais effaçables ; des mouvements les portent déjà ;
 *   * **ajoutées** — en base (`categories_tresorerie`), propres à la filiale ;
 *   * **réservées** — VENTE, REGLEMENT_CLIENT, TRANSFERT_CAISSE… : produites
 *     par les modules métier à partir d'une pièce, jamais choisies à la main.
 *
 * Le code d'une catégorie ajoutée est dérivé du libellé **à la création**, puis
 * figé : c'est lui qui s'écrit dans `mouvements_tresorerie.categorie`. Renommer
 * change le libellé, jamais le code — un historique parti sur plusieurs postes
 * ne se renomme pas.
 */

export interface CategorieTresorerie {
  id: string;
  code: string;
  libelle: string;
  type: TypeMouvementTresorerie;
  est_active: boolean;
}

export function categorieTresorerieFromRow(row: CategorieTresorerieRow): CategorieTresorerie {
  return {
    id: row.id,
    code: row.code ?? '',
    libelle: row.libelle ?? '',
    type: (row.type ?? 'DEPENSE') as TypeMouvementTresorerie,
    est_active: row.est_active !== 0,
  };
}

/**
 * Codes qu'une catégorie ajoutée ne peut pas porter : ils naissent d'une pièce
 * (une vente, un règlement, un transfert) et non d'un choix au guichet. Les
 * laisser prendre brouillerait le journal de caisse, où ils ont un sens précis.
 */
export const CODES_CATEGORIE_RESERVES: readonly string[] = [
  'VENTE', 'REGLEMENT_CLIENT', 'ANNULATION_VENTE', 'REGLEMENT_FOURNISSEUR',
  'TRANSFERT_CAISSE', CATEGORIE_TRANSFERT_FILIALE, CATEGORIE_VERSEMENT, CATEGORIE_RETRAIT, 'AVANCE_SALAIRE',
];

/** Catégories intégrées, par sens. */
export function categoriesIntegrees(type: TypeMouvementTresorerie): readonly string[] {
  return type === 'RECETTE' ? CATEGORIES_RECETTE : CATEGORIES_DEPENSE;
}

/**
 * Code dérivé du libellé : `Frais de dédouanement` → `FRAIS_DE_DEDOUANEMENT`.
 * Même fabrique que les codes de rôle, en majuscules : c'est ce qui s'écrit
 * dans le journal, et un journal se lit sans accent ni espace.
 */
export function normaliserCodeCategorie(libelle: string): string {
  return libelle
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);
}

export const categorieFormSchema = z.object({
  libelle: z.string().trim().min(2, 'Libellé obligatoire').max(40),
  type: z.enum(TYPES_MOUVEMENT_TRESORERIE),
});
export type CategorieForm = z.infer<typeof categorieFormSchema>;
export type CategorieFormInput = z.input<typeof categorieFormSchema>;

/**
 * Pourquoi cette catégorie ne peut pas être créée, ou `null` si elle peut.
 *
 * Le refus nomme ce qui s'y oppose : une catégorie déjà présente se choisit
 * dans la liste (il n'y a rien à créer), une catégorie désactivée se réactive,
 * et un code réservé ne se prend pas. Les deux sens sont regardés ensemble :
 * un même code ne peut pas désigner une recette ici et une dépense là, sinon
 * le journal additionnerait les deux sous un seul libellé.
 */
export function motifCategorieRefusee(
  libelle: string,
  ajoutees: readonly CategorieTresorerie[],
): string | null {
  const code = normaliserCodeCategorie(libelle);
  if (!code) return 'Donnez un nom qui contient au moins une lettre ou un chiffre.';
  if (CODES_CATEGORIE_RESERVES.includes(code)) {
    return `« ${libelle.trim()} » est réservé aux opérations que l'application génère elle-même (ventes, règlements, transferts).`;
  }
  if (LIBELLES_CATEGORIE[code]) {
    return `« ${LIBELLES_CATEGORIE[code]} » existe déjà : choisissez-la dans la liste.`;
  }
  const deja = ajoutees.find((c) => c.code === code);
  if (deja) {
    return deja.est_active
      ? `« ${deja.libelle} » existe déjà : choisissez-la dans la liste.`
      : `« ${deja.libelle} » existe mais a été retirée de la liste : réactivez-la plutôt que d'en créer une seconde.`;
  }
  return null;
}

/** Une entrée de la liste déroulante : son code, son libellé, et d'où elle vient. */
export interface ChoixCategorie {
  code: string;
  libelle: string;
  /** Intégrée à l'application : ni renommable, ni retirable. */
  integree: boolean;
}

/**
 * Ce que la liste de saisie propose pour un sens : les catégories intégrées
 * d'abord — ce sont les plus courantes, et le caissier les connaît de mémoire —
 * puis celles de la maison, par ordre alphabétique. Les désactivées restent
 * dehors.
 */
export function categoriesSaisissables(
  type: TypeMouvementTresorerie,
  ajoutees: readonly CategorieTresorerie[],
): ChoixCategorie[] {
  const integrees = categoriesIntegrees(type).map((code) => ({ code, libelle: LIBELLES_CATEGORIE[code] ?? code, integree: true }));
  const siennes = ajoutees
    .filter((c) => c.type === type && c.est_active)
    .map((c) => ({ code: c.code, libelle: c.libelle, integree: false }))
    .sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr'));
  return [...integrees, ...siennes];
}

/**
 * Table des libellés à afficher, intégrés et ajoutés réunis.
 *
 * Les catégories désactivées y figurent : un mouvement de l'an dernier doit
 * continuer à se lire en clair. Un code inconnu — catégorie d'une autre
 * filiale, ou créée par une version plus récente — s'affiche tel quel, ce qui
 * reste lisible.
 */
export function libellesCategories(ajoutees: readonly CategorieTresorerie[]): Record<string, string> {
  const table: Record<string, string> = { ...LIBELLES_CATEGORIE };
  for (const c of ajoutees) table[c.code] = c.libelle;
  return table;
}
