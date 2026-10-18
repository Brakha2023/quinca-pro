/**
 * Journal d'audit.
 *
 * La table n'est plus synchronisée sur les postes : c'est un journal de
 * surveillance, écrit par Postgres, qui recopiait chaque ligne métier et
 * pesait à lui seul une bonne part de la base locale. La page le lit sur le
 * serveur, en ligne — d'où des valeurs qui arrivent en **objets** JSON (via
 * PostgREST) là où SQLite les rendait en texte.
 */

export interface LigneAudit {
  id: string;
  utilisateur_id: string | null;
  action: string | null;
  table_cible: string | null;
  enregistrement_id: string | null;
  anciennes_valeurs: unknown;
  nouvelles_valeurs: unknown;
  filiale_id: string | null;
  created_at: string | null;
}

/** Valeurs d'une ligne d'audit, qu'elles arrivent en objet (serveur) ou en texte. */
export function valeursAudit(brut: unknown): Record<string, unknown> {
  if (brut && typeof brut === 'object' && !Array.isArray(brut)) return brut as Record<string, unknown>;
  if (typeof brut === 'string' && brut !== '') {
    try {
      const v: unknown = JSON.parse(brut);
      return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

/** Champs réellement modifiés, `updated_at` mis à part : il change à chaque fois et ne dit rien. */
export function differenceAudit(avant: unknown, apres: unknown): Array<[string, unknown, unknown]> {
  const a = valeursAudit(avant);
  const b = valeursAudit(apres);
  const cles = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...cles]
    .filter((k) => k !== 'updated_at' && JSON.stringify(a[k]) !== JSON.stringify(b[k]))
    .map((k) => [k, a[k], b[k]] as [string, unknown, unknown]);
}
