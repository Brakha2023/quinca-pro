import { usagesArticle, type UsagesArticle } from '../../core/articles';
import { supabase } from './client';

/**
 * Ce qui rattache un article à l'activité, compté **sur le serveur**.
 *
 * La base du poste ne garde que douze mois d'activité (`dans_fenetre`) : elle
 * ne peut pas prouver qu'un article n'a jamais servi, seulement qu'il n'a rien
 * servi récemment. Le serveur, lui, a tout. Supprimer un article n'est pas une
 * urgence de comptoir — c'est un geste de gestion, et il demande le réseau.
 *
 * Les comptages partent sans ramener une seule ligne (`head`, `count: exact`) :
 * neuf requêtes vides, une fois, au moment où quelqu'un clique.
 */

/** Tables d'activité qui nomment un article par `article_id`. */
const PAR_ARTICLE_ID: Array<[keyof UsagesArticle, string]> = [
  ['depots', 'stocks'],
  ['mouvements', 'mouvements_stock'],
  ['ventes', 'lignes_vente'],
  ['devis', 'lignes_proforma'],
  ['commandes', 'lignes_commande_fournisseur'],
  ['fabrications', 'lignes_production'],
  ['transferts', 'lignes_transfert_stock'],
];

/**
 * Un comptage illisible n'est pas un zéro.
 *
 * PostgREST rend le nombre dans l'en-tête `Content-Range`, que le navigateur
 * ne laisse lire que si le serveur l'expose (`Access-Control-Expose-Headers`).
 * Prendre l'absence de réponse pour « aucun usage » reviendrait à effacer un
 * article sur un malentendu : on refuse, bruyamment.
 */
function nombreOuRien(count: number | null, table: string): number {
  if (typeof count !== 'number') {
    throw new Error(`Le serveur n'a pas dit combien de lignes de « ${table} » nomment cet article : suppression abandonnée.`);
  }
  return count;
}

async function compter(table: string, articleId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('id', { count: 'exact', head: true })
    .eq('article_id', articleId);
  if (error) throw error;
  return nombreOuRien(count, table);
}

/**
 * Un brouillon porte son panier en JSON, pas en lignes : on y cherche
 * l'identifiant de l'article. Un UUID ne se confond avec rien d'autre.
 */
async function compterBrouillons(articleId: string): Promise<number> {
  const { count, error } = await supabase
    .from('ventes_brouillons')
    .select('id', { count: 'exact', head: true })
    .like('lignes', `%${articleId}%`);
  if (error) throw error;
  return nombreOuRien(count, 'ventes_brouillons');
}

/**
 * Compte les usages de l'article sur le serveur, ou rend `null` si le poste
 * est hors ligne — l'appelant doit alors refuser la suppression, pas la faire.
 */
export async function usagesArticleServeur(articleId: string): Promise<UsagesArticle | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;

  const [nombres, brouillons] = await Promise.all([
    Promise.all(PAR_ARTICLE_ID.map(([, table]) => compter(table, articleId))),
    compterBrouillons(articleId),
  ]);

  return usagesArticle({
    ...Object.fromEntries(PAR_ARTICLE_ID.map(([clef], i) => [clef, nombres[i]])),
    brouillons,
  });
}
