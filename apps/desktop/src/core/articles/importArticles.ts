import type { LigneImportArticle } from './article';

/** Cellule brute d'une feuille de calcul, telle que la rend `XLSX.utils.sheet_to_json({ header: 1 })`. */
export type Cellule = string | number | boolean | Date | null | undefined;

export type ColonneImport = 'code' | 'designation' | 'prix_achat' | 'prix_vente' | 'famille';

/**
 * Entêtes reconnus, normalisés (majuscules, sans accent, ponctuation réduite à l'espace).
 * Les exports du logiciel historique sortent « CODE | DESIGNATION | P. ACHAT | P. VENTE | FAMILLE ».
 */
export const ENTETES_IMPORT: Record<ColonneImport, string[]> = {
  code: ['CODE', 'CODE ARTICLE', 'REFERENCE', 'REF'],
  designation: ['DESIGNATION', 'LIBELLE', 'ARTICLE', 'NOM'],
  prix_achat: ['P ACHAT', 'PRIX ACHAT', 'PRIX D ACHAT', 'PA'],
  prix_vente: ['P VENTE', 'PRIX VENTE', 'PRIX DE VENTE', 'PV'],
  famille: ['FAMILLE', 'CATEGORIE', 'RAYON'],
};

const COLONNES = Object.keys(ENTETES_IMPORT) as ColonneImport[];

/** Lignes de pied de page des états imprimés : elles ne décrivent pas un article. */
const LIGNES_IGNOREES = /^(TOTAL|SOUS TOTAL|NOMBRE|CATALOGUE|ETAT|PAGE)\b/;

export class EntetesIntrouvablesError extends Error {
  constructor() {
    super(
      "Entêtes introuvables : la feuille doit comporter une ligne « CODE | DESIGNATION | P. ACHAT | P. VENTE | FAMILLE » au-dessus des articles.",
    );
    this.name = 'EntetesIntrouvablesError';
  }
}

/** Texte comparable : majuscules, sans accent, ponctuation et espaces multiples réduits à un espace. */
export function normaliserEntete(cellule: Cellule): string {
  return String(cellule ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

function texteCellule(cellule: Cellule): string {
  if (cellule == null || cellule === '') return '';
  if (cellule instanceof Date) return cellule.toISOString().slice(0, 10);
  return String(cellule).trim();
}

/**
 * Montant d'une cellule. Les nombres passent tels quels ; un texte est nettoyé
 * de sa devise et de ses séparateurs de milliers (« 1 234,50 », « 1.234,50 »,
 * « 1,234.50 » donnent tous 1234.5) : le dernier séparateur n'est décimal que
 * s'il est suivi d'une ou deux décimales.
 */
export function nombreImport(cellule: Cellule): number {
  if (typeof cellule === 'number') return Number.isFinite(cellule) ? cellule : 0;
  const texte = String(cellule ?? '').replace(/[^\d,.-]/g, '');
  if (!texte) return 0;
  const separateur = Math.max(texte.lastIndexOf(','), texte.lastIndexOf('.'));
  const decimales = separateur >= 0 ? texte.length - separateur - 1 : 0;
  const estDecimal = separateur >= 0 && decimales >= 1 && decimales <= 2;
  const entier = (estDecimal ? texte.slice(0, separateur) : texte).replace(/[,.]/g, '');
  const valeur = parseFloat(`${entier || '0'}.${estDecimal ? texte.slice(separateur + 1) : '0'}`);
  return Number.isFinite(valeur) ? valeur : 0;
}

export interface EnteteTrouve {
  /** Index de la ligne d'entêtes dans la grille (les articles commencent juste après). */
  ligne: number;
  colonnes: Record<ColonneImport, number>;
}

function colonnesDeLaLigne(ligne: Cellule[]): Partial<Record<ColonneImport, number>> {
  const colonnes: Partial<Record<ColonneImport, number>> = {};
  ligne.forEach((cellule, index) => {
    const entete = normaliserEntete(cellule);
    if (!entete) return;
    for (const colonne of COLONNES) {
      if (colonnes[colonne] === undefined && ENTETES_IMPORT[colonne].includes(entete)) colonnes[colonne] = index;
    }
  });
  return colonnes;
}

/**
 * Repère la ligne d'entêtes et la position de chaque colonne : le nombre de
 * lignes de titre varie d'un export à l'autre, et les colonnes peuvent être
 * dans n'importe quel ordre. Code et désignation sont indispensables.
 */
export function trouverEntete(grille: Cellule[][]): EnteteTrouve | null {
  for (let ligne = 0; ligne < Math.min(grille.length, 25); ligne += 1) {
    const colonnes = colonnesDeLaLigne(grille[ligne] ?? []);
    if (colonnes.code !== undefined && colonnes.designation !== undefined) {
      return {
        ligne,
        colonnes: {
          code: colonnes.code,
          designation: colonnes.designation,
          prix_achat: colonnes.prix_achat ?? -1,
          prix_vente: colonnes.prix_vente ?? -1,
          famille: colonnes.famille ?? -1,
        },
      };
    }
  }
  return null;
}

/**
 * Lignes d'import d'une feuille de calcul. Les titres, les entêtes répétés en
 * tête de page et les lignes de totaux sont écartés ; tout le reste est remonté
 * tel quel pour que `preparerImport` tranche et rende compte des rejets.
 */
export function lignesDepuisGrille(grille: Cellule[][]): LigneImportArticle[] {
  const entete = trouverEntete(grille);
  if (!entete) throw new EntetesIntrouvablesError();
  const { colonnes } = entete;
  const cellule = (ligne: Cellule[], colonne: ColonneImport) =>
    colonnes[colonne] < 0 ? '' : texteCellule(ligne[colonnes[colonne]]);

  const lignes: LigneImportArticle[] = [];
  for (let i = entete.ligne + 1; i < grille.length; i += 1) {
    const ligne = grille[i] ?? [];
    const code = cellule(ligne, 'code');
    const designation = cellule(ligne, 'designation');
    if (!code && !designation) continue;
    // Entêtes répétés à chaque saut de page et lignes de totaux des états imprimés.
    if (ENTETES_IMPORT.code.includes(normaliserEntete(code))) continue;
    if (LIGNES_IGNOREES.test(normaliserEntete(code)) && !designation) continue;
    if (LIGNES_IGNOREES.test(normaliserEntete(designation))) continue;

    lignes.push({
      code,
      designation,
      prix_achat: colonnes.prix_achat < 0 ? 0 : nombreImport(ligne[colonnes.prix_achat]),
      prix_vente: colonnes.prix_vente < 0 ? 0 : nombreImport(ligne[colonnes.prix_vente]),
      famille_nom: cellule(ligne, 'famille') || 'DIVERS',
    });
  }
  return lignes;
}
