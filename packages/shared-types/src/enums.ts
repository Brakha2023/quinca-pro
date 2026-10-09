/**
 * Énumérations métier. Elles reflètent exactement les contraintes CHECK
 * de supabase/migrations/*_init_schema.sql : toute évolution se fait aux deux endroits.
 */

export const PROFILS = ['DIRECTEUR', 'GERANT', 'CAISSIER', 'MAGASINIER'] as const;
export type Profil = (typeof PROFILS)[number];

export const TYPES_FILIALE = ['MAISON_MERE', 'FILIALE'] as const;
export type TypeFiliale = (typeof TYPES_FILIALE)[number];

export const TYPES_MOUVEMENT_STOCK = [
  'ENTREE_ACHAT',
  'SORTIE_VENTE',
  'SORTIE_DESTOCKAGE',
  'TRANSFERT_ENTREE',
  'TRANSFERT_SORTIE',
  'INVENTAIRE',
  'AJUSTEMENT',
  'RETOUR_CLIENT',
  'CASSE',
  'SORTIE_PRODUCTION',
  'ENTREE_PRODUCTION',
] as const;
export type TypeMouvementStock = (typeof TYPES_MOUVEMENT_STOCK)[number];

export const MODES_PAIEMENT = ['ESPECES', 'CHEQUE', 'MOBILE_MONEY', 'CREDIT'] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

export const STATUTS_VENTE = ['EN_ATTENTE', 'VALIDEE', 'ANNULEE'] as const;
export type StatutVente = (typeof STATUTS_VENTE)[number];

export const TYPES_REGLEMENT = ['ESPECES', 'CHEQUE', 'VIREMENT', 'MOBILE_MONEY'] as const;
export type TypeReglement = (typeof TYPES_REGLEMENT)[number];

export const STATUTS_LIVRAISON = ['A_PREPARER', 'EN_COURS', 'LIVREE', 'ANNULEE'] as const;
export type StatutLivraison = (typeof STATUTS_LIVRAISON)[number];

export const TYPES_COMMANDE_FOURNISSEUR = ['COMMANDE', 'BON_COMMANDE'] as const;
export type TypeCommandeFournisseur = (typeof TYPES_COMMANDE_FOURNISSEUR)[number];

export const STATUTS_COMMANDE_FOURNISSEUR = ['BROUILLON', 'ENVOYEE', 'PARTIELLE', 'LIVREE', 'ANNULEE'] as const;
export type StatutCommandeFournisseur = (typeof STATUTS_COMMANDE_FOURNISSEUR)[number];

export const TYPES_MOUVEMENT_TRESORERIE = ['RECETTE', 'DEPENSE'] as const;
export type TypeMouvementTresorerie = (typeof TYPES_MOUVEMENT_TRESORERIE)[number];

export const STATUTS_TRANSFERT_FILIALE = ['EN_TRANSIT', 'RECU', 'ANNULE'] as const;
export type StatutTransfertFiliale = (typeof STATUTS_TRANSFERT_FILIALE)[number];

export const ACTIONS_AUDIT = ['INSERT', 'UPDATE', 'DELETE'] as const;
export type ActionAudit = (typeof ACTIONS_AUDIT)[number];

export const SENS_LIGNE_PRODUCTION = ['MATIERE', 'PRODUIT'] as const;
export type SensLigneProduction = (typeof SENS_LIGNE_PRODUCTION)[number];

export const STATUTS_PROFORMA = ['EN_COURS', 'FACTUREE', 'ANNULEE'] as const;
export type StatutProforma = (typeof STATUTS_PROFORMA)[number];

export const SEXES = ['M', 'F'] as const;
export type Sexe = (typeof SEXES)[number];

export const TYPES_CONTRAT = ['CDI', 'CDD', 'STAGE', 'JOURNALIER', 'PRESTATAIRE'] as const;
export type TypeContrat = (typeof TYPES_CONTRAT)[number];

export const STATUTS_POINTAGE = ['PRESENT', 'ABSENT', 'JUSTIFIE'] as const;
export type StatutPointage = (typeof STATUTS_POINTAGE)[number];

export const STATUTS_PAIE = ['CALCULEE', 'PAYEE'] as const;
export type StatutPaie = (typeof STATUTS_PAIE)[number];
