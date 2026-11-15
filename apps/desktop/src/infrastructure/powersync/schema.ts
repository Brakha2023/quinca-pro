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

/** Nom de la table locale des brouillons du poste (voir `BrouillonsRepository`). */
export const TABLE_BROUILLONS_LOCAUX = 'brouillons_locaux';

/**
 * Copie de sûreté des ventes mises de côté sur **ce** poste.
 *
 * Une écriture faite dans une table synchronisée n'est gardée que si le
 * serveur la renvoie : « all pending local changes must be uploaded,
 * acknowledged, **and synced back** before new data is applied ». Si le flux
 * de synchronisation ne couvre pas la table — une règle ajoutée dans
 * `supabase/sync-streams.yaml` mais pas encore déployée, par exemple —
 * PowerSync révoque la ligne locale au checkpoint suivant. Elle s'affiche
 * quelques secondes, puis s'efface sans que personne n'ait rien demandé.
 *
 * Partout ailleurs c'est sans conséquence : la vente, l'article, le règlement
 * sont dans le flux depuis le premier jour, et un refus définitif passe par
 * `echecs_envoi`, qui garde la donnée et le dit. Le brouillon, lui, était la
 * seule donnée que le poste pouvait perdre en silence — et c'est le panier
 * d'un client qui attend au comptoir.
 *
 * Cette table est **locale** : elle ne part jamais au serveur, donc rien ne la
 * révoque. La copie s'efface d'elle-même dès que la ligne partagée est revenue
 * du serveur (voir `oublierCopiesConfirmees`) ; tant qu'elle n'est pas
 * revenue, le ticket reste sur son poste au lieu de disparaître.
 */
const brouillonsLocaux = Table.createLocalOnly(
  Object.fromEntries(
    Object.entries(TABLES.ventes_brouillons as Record<string, ColumnType>).map(([nom, type]) => [
      nom,
      COLUMN_BUILDERS[type],
    ]),
  ),
);

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
  [TABLE_BROUILLONS_LOCAUX]: brouillonsLocaux,
});
