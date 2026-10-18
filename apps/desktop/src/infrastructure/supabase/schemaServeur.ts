import { TABLES } from '@quinca/shared-types';
import { verdictDepuisErreur, type VerdictTable } from '../../core/sync';
import { supabase } from './client';

/**
 * Sonde le schéma du serveur.
 *
 * Supabase réserve le document OpenAPI de PostgREST à la clé `service_role`,
 * que l'application n'a pas et ne doit pas avoir. On demande donc à chaque
 * table les colonnes qu'on attend d'elle, **sans résultat** (`head`, aucune
 * ligne, aucun octet de données) : PostgREST valide la liste des colonnes
 * avant d'exécuter quoi que ce soit, et refuse en nommant ce qui manque.
 */

/** Colonnes que le poste attend de chaque table, `id` compris. */
export function colonnesAttendues(): Array<{ table: string; colonnes: string[] }> {
  return Object.entries(TABLES as Record<string, Record<string, unknown>>).map(([table, colonnes]) => ({
    table,
    colonnes: ['id', ...Object.keys(colonnes)],
  }));
}

async function sonder(table: string, colonnes: string[]): Promise<VerdictTable> {
  const { error } = await supabase.from(table).select(colonnes.join(','), { head: true }).limit(0);
  return verdictDepuisErreur(table, error);
}

/**
 * Vérifie toutes les tables. Les sondes partent par petits paquets : une
 * trentaine de requêtes sans corps, une fois au démarrage, ne doivent pas
 * retarder l'ouverture de la caisse.
 */
export async function verifierSchemaServeur(parPaquet = 6): Promise<VerdictTable[]> {
  const attendu = colonnesAttendues();
  const verdicts: VerdictTable[] = [];
  for (let i = 0; i < attendu.length; i += parPaquet) {
    const paquet = attendu.slice(i, i + parPaquet);
    verdicts.push(...(await Promise.all(paquet.map((t) => sonder(t.table, t.colonnes)))));
  }
  return verdicts;
}
