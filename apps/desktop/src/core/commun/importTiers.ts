import { normaliserEntete, type Cellule } from '../articles';

/**
 * Reprise d'un répertoire de tiers depuis un classeur — clients ou
 * fournisseurs, soldes d'ouverture compris.
 *
 * C'est ce qu'on fait le jour où la maison passe à QuincaPro : le répertoire
 * existe déjà, sur un cahier ou dans l'ancien logiciel, et chaque tiers y
 * porte ce qu'il doit ou ce qu'on lui doit. Le ressaisir à la main, c'est cent
 * fiches et autant d'occasions de se tromper d'un chiffre sur un solde.
 *
 * Le mécanisme est identique des deux côtés — repérer la ligne d'entêtes où
 * qu'elle soit, suivre les colonnes par leur nom et dans n'importe quel ordre,
 * écarter titres et totaux, refuser d'écraser une fiche existante. Seuls le
 * catalogue des entêtes et la forme de la fiche changent : ils restent chez
 * `importClients` et `importFournisseurs`.
 */

/** Lignes de pied de page des états imprimés : elles ne décrivent pas un tiers. */
const LIGNES_IGNOREES = /^(TOTAL|SOUS TOTAL|NOMBRE|LISTE|ETAT|PAGE|REPERTOIRE|BALANCE)\b/;

export function texteCellule(cellule: Cellule): string {
  if (cellule == null || cellule === '') return '';
  if (cellule instanceof Date) return cellule.toISOString().slice(0, 10);
  return String(cellule).trim();
}

/**
 * Date d'arrêté du solde, ramenée au format `AAAA-MM-JJ`.
 *
 * Excel rend une vraie date comme `Date`, mais un fichier tenu à la main écrit
 * « 31/12/2026 ». On accepte les deux ; ce qu'on ne sait pas lire est laissé
 * vide plutôt que deviné — une date d'arrêté fausse déplacerait un solde d'un
 * exercice à l'autre.
 */
export function dateImport(cellule: Cellule): string {
  if (cellule instanceof Date) return cellule.toISOString().slice(0, 10);
  const texte = texteCellule(cellule);
  if (!texte) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(texte)) return texte.slice(0, 10);
  const jma = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(texte);
  if (!jma) return '';
  const [, j, m, a] = jma;
  const annee = a.length === 2 ? `20${a}` : a;
  return `${annee}-${m.padStart(2, '0')}-${j.padStart(2, '0')}`;
}

/** Nom comparable : c'est la clé de rapprochement quand le fichier n'a pas de codes. */
export const cleTiers = (raisonSociale: string): string => normaliserEntete(raisonSociale);

export interface EnteteTiersTrouve<C extends string> {
  /** Index de la ligne d'entêtes dans la grille (les tiers commencent juste après). */
  ligne: number;
  colonnes: Partial<Record<C, number>>;
}

/**
 * Repère la ligne d'entêtes et la position de chaque colonne. Seule la colonne
 * du nom est exigée : un fichier sans codes ni téléphones reste importable,
 * c'est le cas le plus courant quand le répertoire vient d'un cahier.
 */
export function trouverEnteteTiers<C extends string>(
  grille: Cellule[][],
  catalogue: Record<C, string[]>,
  // `NoInfer` : c'est le catalogue qui dit quelles colonnes existent, pas le
  // nom passé ici — sans cela, TypeScript réduirait le jeu de colonnes à
  // celles nommées dans l'appel.
  colonneNom: NoInfer<C>,
): EnteteTiersTrouve<C> | null {
  const colonnesConnues = Object.keys(catalogue) as C[];
  for (let ligne = 0; ligne < Math.min(grille.length, 25); ligne += 1) {
    const colonnes: Partial<Record<C, number>> = {};
    (grille[ligne] ?? []).forEach((cellule, index) => {
      const entete = normaliserEntete(cellule);
      if (!entete) return;
      for (const colonne of colonnesConnues) {
        if (colonnes[colonne] === undefined && catalogue[colonne].includes(entete)) colonnes[colonne] = index;
      }
    });
    if (colonnes[colonneNom] !== undefined) return { ligne, colonnes };
  }
  return null;
}

/** Lit une cellule de la ligne courante, par le nom de sa colonne. */
export type LecteurLigne<C extends string> = (colonne: C) => Cellule;

/**
 * Parcourt les lignes de tiers d'une feuille et rend un lecteur par ligne
 * retenue. Les titres, les entêtes répétés en tête de page et les lignes de
 * totaux sont écartés ; l'appelant n'a plus qu'à composer sa fiche.
 */
export function parcourirTiers<C extends string>(
  grille: Cellule[][],
  catalogue: Record<C, string[]>,
  colonnes: { nom: NoInfer<C>; code: NoInfer<C> },
  entete: EnteteTiersTrouve<C>,
): Array<LecteurLigne<C>> {
  const lecteurs: Array<LecteurLigne<C>> = [];
  for (let i = entete.ligne + 1; i < grille.length; i += 1) {
    const ligne = grille[i] ?? [];
    const lire: LecteurLigne<C> = (colonne) => {
      const index = entete.colonnes[colonne];
      return index === undefined ? null : ligne[index];
    };
    const nom = texteCellule(lire(colonnes.nom));
    const code = texteCellule(lire(colonnes.code));
    if (!nom && !code) continue;
    // Entêtes répétés à chaque saut de page, et lignes de totaux des états.
    if (catalogue[colonnes.nom].includes(normaliserEntete(nom))) continue;
    if (LIGNES_IGNOREES.test(normaliserEntete(nom))) continue;
    if (!nom && LIGNES_IGNOREES.test(normaliserEntete(code))) continue;
    lecteurs.push(lire);
  }
  return lecteurs;
}

export interface LigneIgnoree {
  ligne: number;
  nom: string;
  raison: string;
}

/** Ce qu'on retient d'un tiers pour le rapprocher de ce qui existe déjà. */
export interface TiersAImporter {
  code: string;
  raison_sociale: string;
}

export interface ExistantsTiers {
  codes: ReadonlySet<string>;
  /** Noms déjà au répertoire, passés par `cleTiers`. */
  noms: ReadonlySet<string>;
}

/**
 * Trie ce qui peut entrer de ce qui doit être écarté.
 *
 * Un tiers déjà au répertoire n'est **jamais** écrasé : reprendre un fichier
 * deux fois ne doit pas doubler les soldes. Le rapprochement se fait sur le
 * code quand le fichier en porte un, et sur le nom sinon — c'est tout ce qu'on
 * a quand le répertoire vient d'un cahier.
 *
 * `libelleExistant` nomme le répertoire dans le message ; c'est le seul mot
 * qui change entre un client et un fournisseur.
 */
export function preparerImportTiers<L extends TiersAImporter>(
  lignes: readonly L[],
  existants: ExistantsTiers,
  libelleExistant = 'au répertoire',
): { valides: L[]; ignores: LigneIgnoree[] } {
  const codesVus = new Set<string>();
  const nomsVus = new Set<string>();
  const valides: L[] = [];
  const ignores: LigneIgnoree[] = [];

  lignes.forEach((ligne, index) => {
    const numero = index + 1;
    const code = ligne.code.trim().toUpperCase();
    const nom = ligne.raison_sociale.trim();
    const cle = cleTiers(nom);

    if (!nom) ignores.push({ ligne: numero, nom: code || '—', raison: 'nom vide' });
    else if (code && existants.codes.has(code)) ignores.push({ ligne: numero, nom, raison: `le code ${code} est déjà ${libelleExistant}` });
    else if (code && codesVus.has(code)) ignores.push({ ligne: numero, nom, raison: `le code ${code} est en double dans le fichier` });
    else if (existants.noms.has(cle)) ignores.push({ ligne: numero, nom, raison: `déjà ${libelleExistant}` });
    else if (nomsVus.has(cle)) ignores.push({ ligne: numero, nom, raison: 'en double dans le fichier' });
    else {
      if (code) codesVus.add(code);
      nomsVus.add(cle);
      valides.push({ ...ligne, code, raison_sociale: nom });
    }
  });

  return { valides, ignores };
}
