import { motifNonSupprimableTiers, resumeAttaches, type CompteTiers } from '../commun/suppressionTiers';

/** Ce qui rattache un client à l'activité. Un seul suffit à le retenir. */
export interface UsagesClient {
  ventes: number;
  reglements: number;
  devis: number;
  livraisons: number;
  /** Ventes mises de côté à son nom : la seule attache qui se défait en un geste. */
  brouillons: number;
}

export const AUCUN_USAGE_CLIENT: UsagesClient = { ventes: 0, reglements: 0, devis: 0, livraisons: 0, brouillons: 0 };

const LIBELLES: ReadonlyArray<readonly [keyof UsagesClient, (n: number) => string]> = [
  ['ventes', (n) => `${n} vente(s)`],
  ['reglements', (n) => `${n} règlement(s)`],
  ['devis', (n) => `${n} devis`],
  ['livraisons', (n) => `${n} livraison(s)`],
  ['brouillons', (n) => `${n} vente(s) en brouillon`],
];

/** Complète ce qui n'a pas été compté : une table absente vaut zéro usage. */
export function usagesClient(partiel: Partial<UsagesClient>): UsagesClient {
  return { ...AUCUN_USAGE_CLIENT, ...partiel };
}

export function resumeUsagesClient(usages: UsagesClient): string[] {
  return resumeAttaches(LIBELLES, usages);
}

/**
 * Pourquoi ce client ne peut pas être supprimé — ou `null` s'il peut l'être.
 * Le message est celui qu'on montre : il dit quoi faire, pas seulement non.
 */
export function motifNonSupprimableClient(
  client: { code: string; raison_sociale: string } & CompteTiers,
  usages: UsagesClient,
): string | null {
  const attaches = resumeUsagesClient(usages);
  const nom = `« ${client.code} — ${client.raison_sociale} »`;
  // Un brouillon ne vend rien : il suffit de reprendre ou de jeter le ticket.
  if (attaches.length === 1 && usages.brouillons > 0) {
    return `Le client ${nom} est encore sur ${usages.brouillons} vente(s) en brouillon : reprenez-les ou jetez-les, puis supprimez la fiche.`;
  }
  return motifNonSupprimableTiers('Le client', nom, client, attaches);
}
