import { arrondirMontant } from '../commun/prix';
import { margeArticle, type Article } from './article';

/**
 * Ce qu'on met au bas d'un catalogue imprimé.
 *
 * Une liste tirée sur papier se lit comme un inventaire complet : il faut
 * qu'elle dise combien d'articles elle contient, et ce qu'elle laisse de côté.
 */
export interface RecapCatalogue {
  nombre: number;
  actifs: number;
  inactifs: number;
  /** Marge moyenne des articles vendus à perte comprise, en %. */
  marge_moyenne: number;
  /** Articles dont le prix de vente ne couvre pas le prix d'achat. */
  a_perte: number;
  /** Articles sans prix de vente : ils ne peuvent pas être vendus en l'état. */
  sans_prix: number;
}

export function recapCatalogue(articles: readonly Article[]): RecapCatalogue {
  const marges = articles.filter((a) => a.prix_achat > 0).map((a) => margeArticle(a));
  const somme = marges.reduce((t, m) => t + m, 0);
  return {
    nombre: articles.length,
    actifs: articles.filter((a) => a.est_actif).length,
    inactifs: articles.filter((a) => !a.est_actif).length,
    marge_moyenne: marges.length > 0 ? arrondirMontant(somme / marges.length) : 0,
    a_perte: articles.filter((a) => a.prix_achat > 0 && a.prix_vente < a.prix_achat).length,
    sans_prix: articles.filter((a) => a.prix_vente <= 0).length,
  };
}

/**
 * Filtres en vigueur, en une phrase.
 *
 * Sans cela, un catalogue filtré imprimé se confond avec le catalogue entier —
 * et c'est ce qu'on emporte chez un client ou chez le comptable.
 */
export function perimetreCatalogue(filtres: {
  recherche?: string;
  familleNom?: string | null;
  inclureInactifs?: boolean;
}): string {
  const parties = [
    filtres.familleNom ? `famille « ${filtres.familleNom} »` : 'toutes familles',
    filtres.recherche?.trim() ? `recherche « ${filtres.recherche.trim()} »` : null,
    filtres.inclureInactifs ? 'articles inactifs compris' : 'articles actifs seulement',
  ].filter(Boolean);
  return parties.join(' · ');
}
