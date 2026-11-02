import type { TypeMouvementStock } from '@quinca/shared-types';
import { arrondirFcfa } from '../commun/prix';

/**
 * Stock dormant et stock actif : l'argent qui dort sur les rayons.
 *
 * Les alertes disent ce qui manque ; celles-ci disent l'inverse — ce qui est
 * là depuis trop longtemps. C'est la question qu'on se pose avant de
 * recommander, de brader ou de rendre la place à un article qui tourne.
 *
 * Ce qui compte comme **rotation**, c'est ce qui est vraiment parti : une
 * vente, un déstockage, une consommation en production. Ni la casse — une
 * perte n'est pas une vente —, ni le transfert, qui ne fait que déplacer la
 * marchandise d'un dépôt à l'autre sans que personne l'ait achetée.
 */
export const TYPES_SORTIE_ROTATION: readonly TypeMouvementStock[] = ['SORTIE_VENTE', 'SORTIE_DESTOCKAGE', 'SORTIE_PRODUCTION'];

/** Délais proposés à l'écran : au-delà, l'article est dit dormant. */
export const SEUILS_DORMANCE = [30, 60, 90, 180] as const;
export const SEUIL_DORMANCE_DEFAUT = 90;

/** Ligne telle que la requête la rend : un article, son stock, sa dernière sortie. */
export interface RotationRow {
  article_id: string | null;
  code: string | null;
  designation: string | null;
  unite: string | null;
  famille_nom: string | null;
  quantite: number | null;
  /** Valeur au coût moyen du dépôt. */
  valeur: number | null;
  /** Dernière sortie connue du poste ; nulle au-delà de la fenêtre locale. */
  derniere_sortie: string | null;
  /** Quantité sortie sur la période observée. */
  quantite_sortie: number | null;
}

export interface LigneRotation {
  article_id: string;
  code: string;
  designation: string;
  unite: string;
  famille_nom: string | null;
  quantite: number;
  valeur: number;
  derniere_sortie: string | null;
  quantite_sortie: number;
  /** Jours écoulés depuis la dernière sortie ; `null` quand aucune n'est connue. */
  jours: number | null;
  dormant: boolean;
}

const jour = 24 * 60 * 60 * 1000;

/** Jours entiers écoulés depuis une date ; `null` si elle manque ou est illisible. */
export function joursDepuis(iso: string | null, maintenant: Date): number | null {
  if (!iso) return null;
  const date = new Date(iso).getTime();
  if (!Number.isFinite(date)) return null;
  return Math.max(Math.floor((maintenant.getTime() - date) / jour), 0);
}

/**
 * Sépare le stock qui dort de celui qui tourne.
 *
 * Seuls les articles **qui ont du stock** sont jugés : un article à zéro ne
 * dort pas, il manque — et les alertes s'en occupent déjà. Un article dont
 * aucune sortie n'est connue est dormant d'autant plus sûrement : le poste
 * garde douze mois d'historique, n'y rien trouver veut dire qu'il n'a pas
 * bougé depuis au moins ce temps-là.
 *
 * Les dormants sont rendus du plus cher au moins cher : c'est la somme qui
 * dort, pas le nombre d'articles, qui décide d'une action. Les actifs vont du
 * plus sorti au moins sorti.
 */
export function classerRotation(
  rows: readonly RotationRow[],
  options: { seuilJours: number; maintenant?: Date },
): { dormants: LigneRotation[]; actifs: LigneRotation[] } {
  const maintenant = options.maintenant ?? new Date();
  const lignes = rows
    .filter((r) => (r.quantite ?? 0) > 0)
    .map<LigneRotation>((r) => {
      const jours = joursDepuis(r.derniere_sortie, maintenant);
      return {
        article_id: r.article_id ?? '',
        code: r.code ?? '',
        designation: r.designation ?? '',
        unite: r.unite ?? '',
        famille_nom: r.famille_nom,
        quantite: r.quantite ?? 0,
        valeur: arrondirFcfa(r.valeur ?? 0),
        derniere_sortie: r.derniere_sortie,
        quantite_sortie: r.quantite_sortie ?? 0,
        jours,
        dormant: jours === null || jours >= options.seuilJours,
      };
    });

  return {
    dormants: lignes.filter((l) => l.dormant).sort((a, b) => b.valeur - a.valeur || a.designation.localeCompare(b.designation, 'fr')),
    actifs: lignes.filter((l) => !l.dormant).sort((a, b) => b.quantite_sortie - a.quantite_sortie || a.designation.localeCompare(b.designation, 'fr')),
  };
}

export interface RecapRotation {
  articles_dormants: number;
  valeur_dormante: number;
  articles_actifs: number;
  valeur_active: number;
  /** Part de la valeur du stock qui dort, en % — le chiffre qui décide. */
  part_dormante: number;
}

export function recapRotation(dormants: readonly LigneRotation[], actifs: readonly LigneRotation[]): RecapRotation {
  const valeur_dormante = arrondirFcfa(dormants.reduce((s, l) => s + l.valeur, 0));
  const valeur_active = arrondirFcfa(actifs.reduce((s, l) => s + l.valeur, 0));
  const total = valeur_dormante + valeur_active;
  return {
    articles_dormants: dormants.length,
    valeur_dormante,
    articles_actifs: actifs.length,
    valeur_active,
    part_dormante: total > 0 ? Math.round((valeur_dormante / total) * 100) : 0,
  };
}

/** Le périmètre observé, en une phrase, pour la feuille imprimée. */
export function perimetreRotation(filtres: {
  seuilJours: number;
  depotNom?: string | null;
  familleNom?: string | null;
  recherche?: string;
}): string {
  return [
    `sans sortie depuis ${filtres.seuilJours} jours`,
    filtres.depotNom ? `dépôt « ${filtres.depotNom} »` : 'tous dépôts',
    filtres.familleNom ? `famille « ${filtres.familleNom} »` : 'toutes familles',
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
  ].filter(Boolean).join(' · ');
}
