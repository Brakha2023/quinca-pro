/**
 * Corriger ou annuler un bon d'entrée déjà enregistré.
 *
 * ### Pourquoi rien n'est effacé
 *
 * Le stock d'un dépôt est **calculé par Postgres**, par application du delta
 * `quantite_apres − quantite_avant` de chaque mouvement à son `INSERT` (voir
 * la migration `cumuls_serveur`). Un `DELETE` du mouvement ne défait donc rien
 * côté serveur : le poste verrait sa correction, puis la valeur du serveur
 * redescendrait l'effacer. Une annulation est donc une **contre-passation** —
 * un mouvement inverse —, et les deux lignes restent au journal. C'est aussi
 * ce que le journal promet : rien n'y est effacé, une correction se lit.
 *
 * ### Ce que la contre-passation ne rend pas
 *
 * Le **coût moyen** du dépôt ne remonte pas en arrière : côté serveur, seules
 * les entrées valorisées le déplacent, un delta négatif le laisse tel quel.
 * Tant que la correction ramène l'article à zéro dans le dépôt, c'est sans
 * effet — la prochaine entrée repart du coût qu'elle porte. Mais si le dépôt
 * en détient encore par ailleurs, le coût moyen garde la trace de l'entrée
 * annulée. L'écran le dit plutôt que de le taire.
 */

/**
 * Reconstitue la saisie d'une ligne depuis la ligne enregistrée.
 *
 * Le journal garde le coût **net** de la remise répartie (voir
 * `repartirRemiseGlobale`) et la part de remise portée par la ligne. Le
 * formulaire, lui, attend le coût **brut** : rouvrir un bon avec son coût net
 * *et* sa remise globale retrancherait le rabais une seconde fois.
 */
export function coutBrutDepuisLigne(ligne: {
  quantite: number;
  cout_unitaire: number | null;
  remise_montant: number;
}): number | '' {
  if (ligne.cout_unitaire == null) return '';
  if (ligne.quantite <= 0) return ligne.cout_unitaire;
  return Math.round(((ligne.quantite * ligne.cout_unitaire) + ligne.remise_montant) / ligne.quantite);
}

/** Ce qu'une annulation retirerait du stock, article par article. */
export interface ImpactCorrection {
  article_id: string;
  depot_id: string;
  code: string;
  designation: string;
  /** Ce que le bon a mis en stock et qui y est encore (net de ses corrections). */
  quantite_retiree: number;
  quantite_avant: number;
  quantite_apres: number;
}

/** Une correction qui descend sous zéro : la marchandise est déjà partie. */
export const passeEnNegatif = (impacts: readonly ImpactCorrection[]): boolean =>
  impacts.some((i) => i.quantite_apres < 0);

/**
 * Le coût moyen du dépôt reste faussé quand il détient encore l'article après
 * la correction : c'est le cas qu'il faut annoncer (voir le cartouche).
 */
export const coutMoyenReste = (impacts: readonly ImpactCorrection[]): boolean =>
  impacts.some((i) => i.quantite_apres > 0);

/**
 * Pourquoi ce bon ne peut pas être corrigé — ou `null` s'il peut l'être.
 * Le message dit quoi faire, pas seulement non.
 */
export function motifNonCorrigeable(etat: {
  /** Net encore en stock au titre du bon : zéro, il a déjà été annulé. */
  netEnStock: number;
  /** Ce qui a déjà été payé sur la pièce portée au compte du fournisseur. */
  montantPaye: number;
  /** Numéro de cette pièce, pour nommer où aller. */
  numeroPiece: string | null;
}): string | null {
  if (etat.netEnStock <= 0) {
    return "Ce bon a déjà été annulé : sa marchandise n'est plus en stock à son titre. Le journal en garde les deux lignes.";
  }
  if (etat.montantPaye > 0) {
    return `Un règlement a déjà été passé sur la pièce ${etat.numeroPiece ?? 'du fournisseur'} : annulez-le d'abord dans Fournisseurs → Règlements, sinon le paiement resterait sans facture.`;
  }
  return null;
}
