import { arrondirFcfa } from '../commun/prix';
import { calculerLigne, type LignePanier } from './panier';
import type { LigneVente } from './vente';
import type { StatutVente } from '@quinca/shared-types';

/**
 * Reprendre une vente déjà enregistrée pour la corriger.
 *
 * Un caissier se trompe de quantité, saisit deux fois le même sac, oublie la
 * remise convenue. Tant que la journée n'est pas validée, le ticket se
 * rattrape : c'est plus honnête qu'une annulation suivie d'une nouvelle vente,
 * qui laisserait un ticket mort dans le journal et un numéro perdu.
 *
 * **Seule une vente en attente se modifie.** Une vente validée est entrée dans
 * la journée de caisse et dans les comptes ; elle ne se corrige plus, elle
 * s'annule — ce qui demande le code du gérant.
 */
export const venteModifiable = (statut: StatutVente | null | undefined): boolean => statut === 'EN_ATTENTE';

/**
 * Les lignes enregistrées, ramenées à la forme d'un panier pour être
 * réouvertes à l'écran. L'unité ne figure pas sur la ligne de vente : elle se
 * relit sur l'article, et vaut « PIECE » si l'article a disparu du catalogue.
 */
export function lignesPanierDepuisVente(
  lignes: LigneVente[],
  uniteArticle: (articleId: string) => string | undefined,
): LignePanier[] {
  return lignes
    .filter((l): l is LigneVente & { article_id: string } => Boolean(l.article_id))
    .map((l) => ({
      article_id: l.article_id,
      code: l.code_article,
      designation: l.designation,
      unite: uniteArticle(l.article_id) ?? 'PIECE',
      prix_unitaire_ttc: l.prix_unitaire_ttc,
      tva_percent: l.tva_percent,
      quantite: l.quantite,
      remise_percent: l.remise_percent,
    }));
}

/**
 * La remise accordée sur la vente, en francs, retrouvée à partir de ce qui est
 * enregistré. `ventes.total_remise` ne convient pas : il additionne la remise
 * de la vente **et** celles des lignes (une proforma en porte). On refait donc
 * la soustraction qui l'avait créée — le total des lignes moins le total payé.
 */
export function remiseDepuisVente(lignes: LignePanier[], totalTtc: number): number {
  const ttcLignes = lignes.reduce((somme, l) => somme + calculerLigne(l).total_ttc, 0);
  return Math.max(arrondirFcfa(ttcLignes - totalTtc), 0);
}
