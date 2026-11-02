import { usagesClient, type UsagesClient } from '../../core/clients';
import { usagesFournisseur, type UsagesFournisseur } from '../../core/fournisseurs';
import { supabase } from './client';

/**
 * Ce qui rattache un client ou un fournisseur à l'activité, compté **sur le
 * serveur**.
 *
 * Même raison que pour un article (voir `usagesArticle`) : la base du poste ne
 * garde que douze mois d'activité, elle ne peut pas prouver qu'une fiche n'a
 * jamais servi — seulement qu'elle n'a rien servi récemment. Supprimer un
 * tiers n'est pas une urgence de comptoir : c'est un geste de gestion, et il
 * demande le réseau.
 *
 * Les comptages partent sans ramener une seule ligne (`head`, `count: exact`).
 */

/** Tables qui nomment un client, et sous quel nom on les dit. */
const TABLES_CLIENT: ReadonlyArray<readonly [keyof UsagesClient, string]> = [
  ['ventes', 'ventes'],
  ['reglements', 'reglements_clients'],
  ['devis', 'proformas'],
  ['livraisons', 'livraisons'],
  ['brouillons', 'ventes_brouillons'],
];

const TABLES_FOURNISSEUR: ReadonlyArray<readonly [keyof UsagesFournisseur, string]> = [
  ['commandes', 'commandes_fournisseurs'],
  ['reglements', 'reglements_fournisseurs'],
  ['entrees', 'mouvements_stock'],
];

/**
 * Un comptage illisible n'est pas un zéro.
 *
 * PostgREST rend le nombre dans l'en-tête `Content-Range`, que le navigateur
 * ne laisse lire que si le serveur l'expose. Prendre l'absence de réponse pour
 * « aucun usage » reviendrait à effacer une fiche sur un malentendu : on
 * refuse, bruyamment.
 */
async function compter(table: string, colonne: string, id: string): Promise<number> {
  const { count, error } = await supabase.from(table).select('id', { count: 'exact', head: true }).eq(colonne, id);
  if (error) throw error;
  if (typeof count !== 'number') {
    throw new Error(`Le serveur n'a pas dit combien de lignes de « ${table} » nomment cette fiche : suppression abandonnée.`);
  }
  return count;
}

/** Hors ligne, on ne compte pas : l'appelant doit refuser la suppression. */
const horsLigne = () => typeof navigator !== 'undefined' && navigator.onLine === false;

export async function usagesClientServeur(clientId: string): Promise<UsagesClient | null> {
  if (horsLigne()) return null;
  const nombres = await Promise.all(TABLES_CLIENT.map(([, table]) => compter(table, 'client_id', clientId)));
  return usagesClient(Object.fromEntries(TABLES_CLIENT.map(([clef], i) => [clef, nombres[i]])));
}

export async function usagesFournisseurServeur(fournisseurId: string): Promise<UsagesFournisseur | null> {
  if (horsLigne()) return null;
  const nombres = await Promise.all(TABLES_FOURNISSEUR.map(([, table]) => compter(table, 'fournisseur_id', fournisseurId)));
  return usagesFournisseur(Object.fromEntries(TABLES_FOURNISSEUR.map(([clef], i) => [clef, nombres[i]])));
}
