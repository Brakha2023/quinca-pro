import { column, Schema, Table } from '@powersync/web';
import { TABLES, type ColumnType } from '@quinca/shared-types';

const COLUMN_BUILDERS = {
  text: column.text,
  integer: column.integer,
  real: column.real,
} as const satisfies Record<ColumnType, unknown>;

function buildTable(columns: Record<string, ColumnType>): Table {
  return new Table(
    Object.fromEntries(Object.entries(columns).map(([name, type]) => [name, COLUMN_BUILDERS[type as ColumnType]])),
  );
}

/** Nom de la table locale des écritures mises de côté (voir `core/sync`). */
export const TABLE_ECHECS_ENVOI = 'echecs_envoi';

/**
 * Écritures refusées définitivement par le serveur, mises de côté au lieu d'être
 * abandonnées. Table **locale** : elle décrit un incident de ce poste, n'est
 * jamais envoyée au serveur et n'alimente donc pas la file d'envoi.
 */
const echecsEnvoi = Table.createLocalOnly({
  /** Transaction locale d'origine : une écriture métier = un lot d'opérations. */
  lot: column.text,
  table_cible: column.text,
  ligne_id: column.text,
  operation: column.text,
  donnees: column.text,
  code: column.text,
  motif: column.text,
  explication: column.text,
  tentatives: column.integer,
  date_echec: column.text,
  utilisateur_id: column.text,
});

/**
 * Schéma de la base SQLite locale, dérivé de la description partagée des tables.
 * Les types de lignes correspondants sont exportés par `@quinca/shared-types` (`Row<'articles'>`, …).
 */
export const AppSchema = new Schema({
  ...Object.fromEntries(
    (Object.entries(TABLES) as Array<[string, Record<string, ColumnType>]>).map(([name, columns]) => [
      name,
      buildTable(columns),
    ]),
  ),
  [TABLE_ECHECS_ENVOI]: echecsEnvoi,
});
