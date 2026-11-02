import { arrondirFcfa } from '../commun/prix';
import type { TypeMouvementTresorerie } from '@quinca/shared-types';

/**
 * Les opérations d'une section du module (dépenses, entrées, versements,
 * retraits) telles qu'on les relit : filtrées, totalisées, ventilées par
 * catégorie, puis imprimées.
 *
 * Le journal de caisse, lui, raconte une caisse dans l'ordre du temps avec son
 * solde courant. Ce n'est pas la même question : ici on veut « combien de
 * transport ce mois-ci, et sur quelles pièces », sans que le solde de la
 * caisse n'entre en scène. D'où une liste à plat, du plus récent au plus
 * ancien, et une ventilation par catégorie en tête.
 *
 * La période et la caisse sont filtrées en SQL (voir `mouvementsTresorerieQuery`)
 * ; la catégorie et la recherche le sont ici — elles portent sur des libellés
 * que seul l'écran connaît.
 */

/** Opération telle que la liste et le document la lisent. */
export interface LigneOperation {
  id: string;
  date: string;
  type: TypeMouvementTresorerie;
  categorie: string;
  /** Libellé de la catégorie, intégré ou propre à la maison. */
  categorie_libelle: string;
  description: string;
  piece: string;
  caisse: string;
  operateur: string;
  montant: number;
}

export interface FiltresOperations {
  /** Catégorie unique retenue ; vide = toutes celles de la section. */
  categorie?: string;
  /** Description, pièce, caisse, catégorie, opérateur. */
  recherche?: string;
}

/** Recherche libre et catégorie retenue, dans cet ordre. */
export function filtrerOperations(lignes: readonly LigneOperation[], filtres: FiltresOperations = {}): LigneOperation[] {
  const q = filtres.recherche?.trim().toLowerCase() ?? '';
  return lignes.filter((l) => {
    if (filtres.categorie && l.categorie !== filtres.categorie) return false;
    if (!q) return true;
    return `${l.description} ${l.piece} ${l.caisse} ${l.categorie_libelle} ${l.operateur}`.toLowerCase().includes(q);
  });
}

export interface VentilationCategorie {
  categorie: string;
  libelle: string;
  nombre: number;
  montant: number;
  /** Part du total des opérations retenues, en pourcentage entier. */
  part: number;
}

export interface RecapOperations {
  nombre: number;
  recettes: number;
  depenses: number;
  /** Ce que les opérations retenues font bouger en tout : recettes − dépenses. */
  net: number;
  /** Le total qui s'affiche en bas de la liste : les deux sens cumulés en valeur absolue. */
  total: number;
  ventilation: VentilationCategorie[];
}

/**
 * Totaux et ventilation des opérations retenues.
 *
 * Une section ne porte qu'un sens (les dépenses sortent, les versements
 * entrent), mais la liste peut en mélanger deux quand on élargit le filtre :
 * les deux totaux sont donc tenus séparément, et `total` les additionne en
 * valeur absolue — c'est le volume manipulé, celui qu'on rapproche d'une
 * liasse de pièces.
 */
export function recapOperations(lignes: readonly LigneOperation[]): RecapOperations {
  const somme = (retenues: readonly LigneOperation[]) => arrondirFcfa(retenues.reduce((s, l) => s + l.montant, 0));
  const recettes = somme(lignes.filter((l) => l.type === 'RECETTE'));
  const depenses = somme(lignes.filter((l) => l.type === 'DEPENSE'));
  const total = arrondirFcfa(recettes + depenses);

  const parCategorie = new Map<string, VentilationCategorie>();
  for (const l of lignes) {
    const ligne = parCategorie.get(l.categorie) ?? { categorie: l.categorie, libelle: l.categorie_libelle, nombre: 0, montant: 0, part: 0 };
    ligne.nombre += 1;
    ligne.montant = arrondirFcfa(ligne.montant + l.montant);
    parCategorie.set(l.categorie, ligne);
  }
  const ventilation = [...parCategorie.values()]
    .map((v) => ({ ...v, part: total > 0 ? Math.round((v.montant / total) * 100) : 0 }))
    .sort((a, b) => b.montant - a.montant);

  return { nombre: lignes.length, recettes, depenses, net: arrondirFcfa(recettes - depenses), total, ventilation };
}

export interface PerimetreOperations {
  /** Jours déjà mis en forme (JJ/MM/AAAA) : le document les imprime tels quels. */
  debut: string;
  fin: string;
  caisseNom?: string | null;
  categorieLibelle?: string | null;
  recherche?: string;
}

/** Filtres en vigueur, en une phrase : écrite sur le document et dans l'export. */
export function perimetreOperations(filtres: PerimetreOperations): string {
  return [
    `du ${filtres.debut} au ${filtres.fin}`,
    filtres.caisseNom ? `caisse « ${filtres.caisseNom} »` : 'toutes les caisses',
    filtres.categorieLibelle ? `catégorie « ${filtres.categorieLibelle} »` : null,
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
  ].filter(Boolean).join(' · ');
}
