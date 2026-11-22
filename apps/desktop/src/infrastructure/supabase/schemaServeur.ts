import { TABLES } from '@quinca/shared-types';
import { verdictDepuisErreur, type VerdictTable } from '../../core/sync';
import { supabase } from './client';

/**
 * Sonde le schéma du serveur.
 *
 * Supabase réserve le document OpenAPI de PostgREST à la clé `service_role`,
 * que l'application n'a pas et ne doit pas avoir. On demande donc à chaque
 * table les colonnes qu'on attend d'elle, **sans résultat** (`limit(0)`, donc
 * un corps de deux octets : `[]`) : PostgREST valide la liste des colonnes
 * avant d'exécuter quoi que ce soit, et refuse en nommant ce qui manque.
 *
 * **Surtout pas `head: true`.** Une réponse à un `HEAD` n'a pas de corps, par
 * définition — et le refus de PostgREST *est* un corps JSON
 * (`{"code":"42703","message":"column … does not exist"}`). Avec `head`, le
 * poste recevait un 400 nu : ni code, ni message, donc ni « colonne absente »
 * ni nom de colonne, et le bandeau se contentait d'un « n'a pas pu être
 * vérifiée () » qui ne disait rien. La sonde était aveugle à ce pour quoi elle
 * existe. Le coût évité était de deux octets.
 */

/** Colonnes que le poste attend de chaque table, `id` compris. */
export function colonnesAttendues(): Array<{ table: string; colonnes: string[] }> {
  return Object.entries(TABLES as Record<string, Record<string, unknown>>).map(([table, colonnes]) => ({
    table,
    colonnes: ['id', ...Object.keys(colonnes)],
  }));
}

async function sonder(table: string, colonnes: string[]): Promise<VerdictTable> {
  const { error } = await supabase.from(table).select(colonnes.join(',')).limit(0);
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
