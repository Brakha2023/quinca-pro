/**
 * Accord entre le poste et le serveur.
 *
 * Le poste écrit dans sa base locale selon le schéma qu'il connaît. Si le
 * serveur n'a pas la même idée — une migration pas encore appliquée, une
 * colonne renommée — l'écriture part, se fait refuser, et la file d'envoi
 * reste bloquée : l'application a l'air de fonctionner, et rien ne remonte.
 * C'est exactement ce qui s'est produit avec `remise_percent`.
 *
 * Le contrôle a deux volets, l'un et l'autre gratuits :
 *   1. les **colonnes** attendues, sondées sur Supabase (une requête sans
 *      résultat par table : PostgREST refuse une colonne inconnue) ;
 *   2. les **flux** attendus, lus dans l'état de synchronisation PowerSync,
 *      qui les porte déjà.
 */

/** Flux que le poste attend du service (voir `supabase/sync-streams.yaml`). */
export const FLUX_ATTENDUS = ['referentiel', 'activite'] as const;

export type EtatTable = 'OK' | 'TABLE_ABSENTE' | 'COLONNE_ABSENTE' | 'REFUS';

export interface VerdictTable {
  table: string;
  etat: EtatTable;
  /** Colonne manquante, quand le serveur l'a nommée. */
  colonne?: string;
  /** Message brut du serveur, pour l'administrateur. */
  message?: string;
}

/** `column ventes.remise_percent does not exist` → `remise_percent`. */
export function colonneAbsente(message: string | null | undefined, table: string): string | null {
  if (!message) return null;
  const nomme = new RegExp(`column ${table}\\.(\\w+) does not exist`, 'i').exec(message);
  if (nomme) return nomme[1];
  const simple = /column "?([\w.]+)"? does not exist/i.exec(message);
  if (simple) return simple[1].replace(`${table}.`, '');
  return null;
}

/**
 * Verdict pour une table, à partir du refus de PostgREST.
 * `42703` : colonne inconnue. `PGRST205` / `42P01` : table inconnue.
 * Tout le reste (réseau, droits) n'est pas un désaccord de schéma.
 */
export function verdictDepuisErreur(table: string, erreur: { code?: string; message?: string } | null): VerdictTable {
  if (!erreur) return { table, etat: 'OK' };
  const code = erreur.code ?? '';
  if (code === '42703') {
    const colonne = colonneAbsente(erreur.message, table);
    return { table, etat: 'COLONNE_ABSENTE', colonne: colonne ?? undefined, message: erreur.message };
  }
  if (code === 'PGRST205' || code === '42P01') return { table, etat: 'TABLE_ABSENTE', message: erreur.message };
  return { table, etat: 'REFUS', message: erreur.message };
}

export interface DesaccordSchema {
  /** Ce qui empêchera une écriture d'aboutir. */
  bloquants: string[];
  /** Ce qui mérite d'être su sans empêcher de travailler. */
  remarques: string[];
}

export function fluxManquants(attendus: readonly string[], servis: readonly string[]): string[] {
  return attendus.filter((f) => !servis.includes(f));
}

/**
 * Ce qu'on dit au poste. Une table ou une colonne absente est bloquante : les
 * écritures qui la portent seront refusées. Un flux absent ne bloque pas la
 * saisie, mais le poste travaille sur des données incomplètes — ce qui est
 * pire si personne ne le sait.
 */
export function desaccordSchema(verdicts: readonly VerdictTable[], fluxAbsents: readonly string[]): DesaccordSchema | null {
  const bloquants: string[] = [];
  const remarques: string[] = [];

  for (const v of verdicts) {
    if (v.etat === 'TABLE_ABSENTE') bloquants.push(`la table « ${v.table} » n'existe pas sur le serveur`);
    else if (v.etat === 'COLONNE_ABSENTE') {
      bloquants.push(v.colonne
        ? `« ${v.table} » n'a pas la colonne « ${v.colonne} » sur le serveur`
        : `« ${v.table} » n'a pas toutes les colonnes attendues sur le serveur`);
    } else if (v.etat === 'REFUS') remarques.push(`« ${v.table} » n'a pas pu être vérifiée (${v.message ?? 'refus du serveur'})`);
  }

  for (const flux of fluxAbsents) {
    remarques.push(`le flux « ${flux} » n'est pas servi : ce poste ne reçoit pas tout ce qu'il devrait`);
  }

  return bloquants.length || remarques.length ? { bloquants, remarques } : null;
}

/** Phrase d'en-tête du bandeau, selon la gravité. */
export function titreDesaccord(desaccord: DesaccordSchema): string {
  return desaccord.bloquants.length > 0
    ? 'Le serveur n’a pas le même schéma que ce poste'
    : 'Vérification du serveur incomplète';
}
