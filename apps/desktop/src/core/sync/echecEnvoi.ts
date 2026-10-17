/**
 * Écritures que le serveur refuse définitivement.
 *
 * PowerSync rejoue la file d'envoi indéfiniment, ce qui est la bonne réponse à
 * une panne de réseau ou à une migration en retard. Mais pour un refus
 * *définitif* — numéro en doublon, ligne liée absente, règle de sécurité — le
 * rejeu ne corrigera jamais rien : la file resterait bloquée pour toujours.
 *
 * L'opération est donc **mise de côté** dans une table locale au lieu d'être
 * abandonnée en silence : la file repart, rien n'est perdu, et un responsable
 * décide (réessayer après correction, ou abandonner en connaissance de cause).
 */

/** Sens de l'opération dans la file d'envoi, tel que PowerSync le nomme. */
export type OperationEnvoi = 'PUT' | 'PATCH' | 'DELETE';

export const LIBELLES_OPERATION: Record<OperationEnvoi, string> = {
  PUT: 'Création',
  PATCH: 'Modification',
  DELETE: 'Suppression',
};

/**
 * Codes Postgres pour lesquels réessayer est inutile : la ligne est rejetée
 * pour ce qu'elle contient, pas pour l'état du réseau ou du schéma.
 *
 * - classe `22` : donnée mal formée (type, format)
 * - classe `23` : contrainte violée (unicité, clé étrangère, non nul, vérification)
 * - `42501` : droits insuffisants (RLS)
 *
 * Tout le reste — réseau, 5xx, table ou colonne absente (`PGRST205`, `42703`) —
 * est réparable côté serveur : on laisse PowerSync réessayer.
 *
 * La classe se lit sur les deux premiers caractères, et le reste peut contenir
 * des lettres : `22P02` (texte invalide pour le type) est l'un des refus les
 * plus courants, et un motif en `\d{3}` le laissait passer pour réparable —
 * donc rejoué sans fin.
 */
const CODES_DEFINITIFS = [/^22[0-9A-Z]{3}$/, /^23[0-9A-Z]{3}$/, /^42501$/];

function codeErreur(erreur: unknown): string | null {
  const code = (erreur as { code?: unknown } | null)?.code;
  return typeof code === 'string' && code !== '' ? code : null;
}

export function estEchecDefinitif(erreur: unknown): boolean {
  const code = codeErreur(erreur);
  return code !== null && CODES_DEFINITIFS.some((re) => re.test(code));
}

/** Ce qu'on explique à qui lit le bandeau : le code brut ne lui dit rien. */
const EXPLICATIONS: Array<[RegExp, string]> = [
  [/^23505$/, 'Doublon : une ligne porte déjà ce numéro, ce code ou cette référence sur le serveur.'],
  [/^23503$/, "La ligne liée n'existe pas sur le serveur (elle a pu être supprimée, ou son envoi a échoué avant)."],
  [/^23502$/, 'Un champ obligatoire est vide.'],
  [/^23514$/, 'Une règle du serveur refuse cette valeur.'],
  [/^23\d{3}$/, 'Une contrainte du serveur refuse cette ligne.'],
  [/^42501$/, "Droits insuffisants : cette écriture sort du périmètre autorisé pour ce compte."],
  [/^22\d{3}$/, 'Donnée mal formée pour le serveur (type ou format).'],
];

export interface MotifEchec {
  code: string | null;
  /** Message brut du serveur, pour l'administrateur. */
  message: string;
  /** Même chose en clair, pour la personne au comptoir. */
  explication: string;
}

export function motifEchec(erreur: unknown): MotifEchec {
  const code = codeErreur(erreur);
  const brut = (erreur as { message?: unknown } | null)?.message;
  const message = typeof brut === 'string' && brut !== '' ? brut : 'Refus du serveur sans message';
  const explication = (code && EXPLICATIONS.find(([re]) => re.test(code))?.[1]) ?? 'Refus définitif du serveur.';
  return { code, message, explication };
}

/** Noms de tables parlants ; le reste retombe sur le nom technique, lisible. */
const LIBELLES_TABLE: Record<string, string> = {
  ventes: 'Vente',
  lignes_vente: 'Ligne de vente',
  mouvements_stock: 'Mouvement de stock',
  mouvements_tresorerie: 'Mouvement de caisse',
  reglements_clients: 'Règlement client',
  reglements_fournisseurs: 'Règlement fournisseur',
  commandes_fournisseurs: 'Commande fournisseur',
  lignes_commande_fournisseur: 'Ligne de commande',
  avances_salaire: 'Avance sur salaire',
  transferts_filiales: 'Transfert entre filiales',
};

export function libelleTable(table: string): string {
  return LIBELLES_TABLE[table] ?? table.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

export interface EchecEnvoi {
  id: string;
  /** Transaction locale d'origine : une écriture métier = un lot d'opérations. */
  lot: string | null;
  table_cible: string;
  ligne_id: string;
  operation: OperationEnvoi;
  /** Contenu envoyé au serveur, tel quel (`null` pour une suppression). */
  donnees: Record<string, unknown> | null;
  code: string | null;
  motif: string;
  explication: string;
  tentatives: number;
  date_echec: string;
  utilisateur_id: string | null;
}

export interface EchecEnvoiRow {
  id: string;
  lot: string | null;
  table_cible: string | null;
  ligne_id: string | null;
  operation: string | null;
  donnees: string | null;
  code: string | null;
  motif: string | null;
  explication: string | null;
  tentatives: number | null;
  date_echec: string | null;
  utilisateur_id: string | null;
}

function donneesDepuisJson(brut: string | null): Record<string, unknown> | null {
  if (!brut) return null;
  try {
    const valeur: unknown = JSON.parse(brut);
    return valeur && typeof valeur === 'object' ? (valeur as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function echecFromRow(row: EchecEnvoiRow): EchecEnvoi {
  return {
    id: row.id,
    lot: row.lot,
    table_cible: row.table_cible ?? '',
    ligne_id: row.ligne_id ?? '',
    operation: (row.operation as OperationEnvoi) ?? 'PUT',
    donnees: donneesDepuisJson(row.donnees),
    code: row.code,
    motif: row.motif ?? '',
    explication: row.explication ?? '',
    tentatives: row.tentatives ?? 1,
    date_echec: row.date_echec ?? '',
    utilisateur_id: row.utilisateur_id,
  };
}

/** Résumé d'une écriture mise de côté, pour la liste et le bandeau. */
export function resumeEchec(echec: EchecEnvoi): string {
  return `${LIBELLES_OPERATION[echec.operation]} · ${libelleTable(echec.table_cible)}`;
}
