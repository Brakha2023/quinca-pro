import { z } from 'zod';
import { TYPES_REGLEMENT, type CaisseRow, type MouvementTresorerieRow, type StatutTransfertFiliale, type TransfertFilialeRow, type TypeMouvementTresorerie } from '@quinca/shared-types';

export interface Caisse {
  id: string;
  code: string;
  nom: string;
  responsable: string | null;
  solde_actuel: number;
  filiale_id: string;
  est_active: boolean;
}

export const caisseFormSchema = z.object({
  code: z.string().trim().min(1, 'Code obligatoire').max(10).transform((s) => s.toUpperCase()),
  nom: z.string().trim().min(1, 'Nom obligatoire').max(60),
  responsable: z.string().trim().max(60).optional().default(''),
});
export type CaisseForm = z.infer<typeof caisseFormSchema>;
export type CaisseFormInput = z.input<typeof caisseFormSchema>;

export function caisseFromRow(row: CaisseRow): Caisse {
  return { id: row.id, code: row.code ?? '', nom: row.nom ?? '', responsable: row.responsable, solde_actuel: row.solde_actuel ?? 0, filiale_id: row.filiale_id ?? '', est_active: row.est_active !== 0 };
}

/**
 * Catégories **intégrées**, saisissables à la main. La filiale en ajoute
 * d'autres (voir `categories.ts`) ; celles-ci restent dans le code parce que
 * des mouvements les portent déjà et qu'elles ne doivent pas pouvoir
 * disparaître. Les autres codes (VENTE, REGLEMENT_*…) sont générés par les
 * modules métier à partir d'une pièce.
 */
export const CATEGORIES_RECETTE = ['APPORT', 'REMBOURSEMENT', 'AUTRE_RECETTE'] as const;
export const CATEGORIES_DEPENSE = ['TRANSPORT', 'FOURNITURES', 'LOYER', 'SALAIRE', 'ELECTRICITE_EAU', 'ENTRETIEN', 'REPAS', 'AUTRE_DEPENSE'] as const;

/** Catégories propres aux sections du module (jamais saisies à la main dans « Dépense »). */
export const CATEGORIE_VERSEMENT = 'VERSEMENT';
export const CATEGORIE_RETRAIT = 'RETRAIT';
export const CATEGORIE_TRANSFERT_FILIALE = 'TRANSFERT_FILIALE';

export const LIBELLES_CATEGORIE: Record<string, string> = {
  VENTE: 'Vente', REGLEMENT_CLIENT: 'Règlement client', ANNULATION_VENTE: 'Annulation de vente', REGLEMENT_FOURNISSEUR: 'Règlement fournisseur',
  TRANSFERT_CAISSE: 'Transfert entre caisses', TRANSFERT_FILIALE: 'Transfert inter-filiale', VERSEMENT: 'Versement', RETRAIT: 'Retrait d’espèces', AVANCE_SALAIRE: 'Avance sur salaire', APPORT: 'Apport de fonds', REMBOURSEMENT: 'Remboursement', AUTRE_RECETTE: 'Autre recette',
  TRANSPORT: 'Transport', FOURNITURES: 'Fournitures', LOYER: 'Loyer', SALAIRE: 'Salaires', ELECTRICITE_EAU: 'Électricité / eau', ENTRETIEN: 'Entretien', REPAS: 'Repas', AUTRE_DEPENSE: 'Autre dépense',
};

export const operationSchema = z.object({
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  type: z.enum(['RECETTE', 'DEPENSE']),
  categorie: z.string().min(1, 'Catégorie obligatoire'),
  montant: z.coerce.number().positive('Montant > 0'),
  /** Qui dépose ou encaisse : repris en tête de la description et sur le reçu. */
  tiers: z.string().trim().max(80).optional().default(''),
  description: z.string().trim().max(200).optional().default(''),
  reference: z.string().trim().max(60).optional().default(''),
});
export type OperationForm = z.infer<typeof operationSchema>;
export type OperationFormInput = z.input<typeof operationSchema>;

export const transfertCaisseSchema = z
  .object({
    caisse_source_id: z.string().min(1, 'Caisse source obligatoire'),
    caisse_destination_id: z.string().min(1, 'Caisse destination obligatoire'),
    montant: z.coerce.number().positive('Montant > 0'),
    motif: z.string().trim().max(200).optional().default(''),
  })
  .refine((t) => t.caisse_source_id !== t.caisse_destination_id, { message: 'Les deux caisses doivent être différentes', path: ['caisse_destination_id'] });
export type TransfertCaisseForm = z.infer<typeof transfertCaisseSchema>;
export type TransfertCaisseFormInput = z.input<typeof transfertCaisseSchema>;

export interface MouvementTresorerie {
  id: string;
  type: TypeMouvementTresorerie;
  categorie: string;
  montant: number;
  description: string | null;
  reference: string | null;
  caisse_id: string;
  utilisateur_id: string | null;
  date_operation: string;
}

export function mouvementTresorerieFromRow(row: MouvementTresorerieRow): MouvementTresorerie {
  return {
    id: row.id, type: (row.type ?? 'RECETTE') as TypeMouvementTresorerie, categorie: row.categorie ?? '', montant: row.montant ?? 0, description: row.description,
    reference: row.reference, caisse_id: row.caisse_id ?? '', utilisateur_id: row.utilisateur_id, date_operation: row.date_operation ?? '',
  };
}

/**
 * Versement encaissé au guichet : de l'argent qui entre en caisse, au nom de
 * celui qui l'apporte.
 *
 * Aucun compte de tiers n'est touché. Un client qui règle sa créance passe par
 * *Clients → Compte client*, où l'on voit ses factures et où le règlement se
 * lettre : le faire aussi d'ici laisserait deux saisies pour une même somme,
 * sans que rien ne les rapproche.
 */
export const versementSchema = z.object({
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  remettant: z.string().trim().min(1, 'Nom du remettant obligatoire').max(80),
  montant: z.coerce.number().positive('Montant > 0'),
  type_reglement: z.enum(TYPES_REGLEMENT).default('ESPECES'),
  designation: z.string().trim().max(120).optional().default(''),
  observation: z.string().trim().max(200).optional().default(''),
  reference: z.string().trim().max(60).optional().default(''),
});
export type VersementForm = z.infer<typeof versementSchema>;
export type VersementFormInput = z.input<typeof versementSchema>;

/** Retrait d'espèces de la caisse (remise au gérant, dépôt en banque…). */
export const retraitSchema = z.object({
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  beneficiaire: z.string().trim().min(1, 'Bénéficiaire obligatoire').max(80),
  montant: z.coerce.number().positive('Montant > 0'),
  motif: z.string().trim().max(200).optional().default(''),
  reference: z.string().trim().max(60).optional().default(''),
});
export type RetraitForm = z.infer<typeof retraitSchema>;
export type RetraitFormInput = z.input<typeof retraitSchema>;

/** Envoi d'espèces vers une autre filiale : la caisse d'arrivée est choisie à la réception. */
export const transfertFilialeSchema = z.object({
  caisse_source_id: z.string().min(1, 'Caisse obligatoire'),
  filiale_destination_id: z.string().min(1, 'Filiale destinataire obligatoire'),
  montant: z.coerce.number().positive('Montant > 0'),
  motif: z.string().trim().max(200).optional().default(''),
});
export type TransfertFilialeForm = z.infer<typeof transfertFilialeSchema>;
export type TransfertFilialeFormInput = z.input<typeof transfertFilialeSchema>;

export interface TransfertFiliale {
  id: string;
  numero: string;
  filiale_source_id: string;
  filiale_destination_id: string;
  caisse_source_id: string;
  caisse_destination_id: string | null;
  montant: number;
  motif: string | null;
  statut: StatutTransfertFiliale;
  date_envoi: string;
  date_reception: string | null;
}

export function transfertFilialeFromRow(row: TransfertFilialeRow): TransfertFiliale {
  return {
    id: row.id, numero: row.numero ?? '', filiale_source_id: row.filiale_source_id ?? '', filiale_destination_id: row.filiale_destination_id ?? '',
    caisse_source_id: row.caisse_source_id ?? '', caisse_destination_id: row.caisse_destination_id, montant: row.montant ?? 0, motif: row.motif,
    statut: (row.statut ?? 'EN_TRANSIT') as StatutTransfertFiliale, date_envoi: row.date_envoi ?? '', date_reception: row.date_reception,
  };
}

export const LIBELLES_STATUT_TRANSFERT: Record<StatutTransfertFiliale, string> = {
  EN_TRANSIT: 'En transit',
  RECU: 'Reçu',
  ANNULE: 'Annulé',
};

/** Un transfert ne se reçoit ou ne s'annule que tant qu'il est en transit. */
export const transfertModifiable = (t: Pick<TransfertFiliale, 'statut'>): boolean => t.statut === 'EN_TRANSIT';

/**
 * Qui peut agir sur un transfert : l'expéditeur peut l'annuler tant qu'il
 * n'est pas arrivé, le destinataire peut l'encaisser.
 */
export function roleFiliale(t: Pick<TransfertFiliale, 'filiale_source_id' | 'filiale_destination_id'>, filialeId: string): 'EXPEDITEUR' | 'DESTINATAIRE' | 'TIERS' {
  if (t.filiale_source_id === filialeId) return 'EXPEDITEUR';
  if (t.filiale_destination_id === filialeId) return 'DESTINATAIRE';
  return 'TIERS';
}
