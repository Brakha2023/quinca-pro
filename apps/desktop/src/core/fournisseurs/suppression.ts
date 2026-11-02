import { motifNonSupprimableTiers, resumeAttaches, type CompteTiers } from '../commun/suppressionTiers';

/** Ce qui rattache un fournisseur à l'activité. Un seul suffit à le retenir. */
export interface UsagesFournisseur {
  /** Bons de commande et achats réceptionnés. */
  commandes: number;
  reglements: number;
  /** Entrées en stock qui portent sa provenance : c'est l'histoire du magasin. */
  entrees: number;
}

export const AUCUN_USAGE_FOURNISSEUR: UsagesFournisseur = { commandes: 0, reglements: 0, entrees: 0 };

const LIBELLES: ReadonlyArray<readonly [keyof UsagesFournisseur, (n: number) => string]> = [
  ['commandes', (n) => `${n} commande(s) ou achat(s)`],
  ['reglements', (n) => `${n} règlement(s)`],
  ['entrees', (n) => `${n} entrée(s) en stock à son nom`],
];

export function usagesFournisseur(partiel: Partial<UsagesFournisseur>): UsagesFournisseur {
  return { ...AUCUN_USAGE_FOURNISSEUR, ...partiel };
}

export function resumeUsagesFournisseur(usages: UsagesFournisseur): string[] {
  return resumeAttaches(LIBELLES, usages);
}

/**
 * Pourquoi ce fournisseur ne peut pas être supprimé — ou `null` s'il peut
 * l'être.
 *
 * Une entrée en stock ne garde du fournisseur qu'une référence effaçable
 * (`on delete set null`) : le serveur accepterait donc l'effacement, et la
 * provenance de la marchandise disparaîtrait en silence. C'est précisément ce
 * qu'on refuse ici.
 */
export function motifNonSupprimableFournisseur(
  fournisseur: { code: string; raison_sociale: string } & CompteTiers,
  usages: UsagesFournisseur,
): string | null {
  const nom = `« ${fournisseur.code} — ${fournisseur.raison_sociale} »`;
  return motifNonSupprimableTiers('Le fournisseur', nom, fournisseur, resumeUsagesFournisseur(usages));
}
