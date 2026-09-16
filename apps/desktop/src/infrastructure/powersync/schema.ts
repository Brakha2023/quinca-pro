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

/**
 * Schéma de la base SQLite locale, dérivé de la description partagée des tables.
 * Les types de lignes correspondants sont exportés par `@quinca/shared-types` (`Row<'articles'>`, …).
 */
export const AppSchema = new Schema(
  Object.fromEntries(
    (Object.entries(TABLES) as Array<[string, Record<string, ColumnType>]>).map(([name, columns]) => [
      name,
      buildTable(columns),
    ]),
  ),
);
