import { z } from 'zod';
import type { DepenseRow, StatutDepense } from '@quinca/shared-types';
import { arrondirFcfa } from '../commun/prix';

/**
 * Dépense engagée, en attente d'approbation.
 *
 * Le menu « Dépense » suit le menu « Vente » : la pièce est d'abord engagée
 * par qui constate la dépense, puis **validée** par qui en a le droit
 * (`depenses.valider`) — et c'est la validation qui fait sortir l'argent de la
 * caisse. Entre les deux, la dépense existe, se lit, se corrige, et ne coûte
 * rien : la caisse ne bouge pas d'un franc.
 *
 * Ce n'est donc pas la même chose que `Trésorerie → Dépense`, qui débite tout
 * de suite et sert au menu courant du comptoir. Ici, on demande ; là, on paie.
 */
export interface Depense {
  id: string;
  numero: string;
  filiale_id: string;
  caisse_id: string;
  categorie: string;
  montant: number;
  beneficiaire: string | null;
  description: string | null;
  /** Pièce justificative du dehors : facture, reçu, bordereau. */
  reference: string | null;
  date_depense: string;
  statut: StatutDepense;
  motif_refus: string | null;
  /** Qui a engagé la dépense. */
  utilisateur_id: string | null;
  /** Qui l'a approuvée : une autorisation sans nom n'en est pas une. */
  valide_par: string | null;
  date_validation: string | null;
  notes: string | null;
}

export const LIBELLES_STATUT_DEPENSE: Record<StatutDepense, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE: 'Validée',
  REFUSEE: 'Refusée',
};

/**
 * **Seule une dépense en attente se modifie.** Validée, l'argent est sorti de
 * la caisse et la pièce est entrée dans le journal : elle ne se retouche plus,
 * elle se remet d'abord en attente.
 */
export const depenseModifiable = (statut: StatutDepense | null | undefined): boolean => statut === 'EN_ATTENTE';

/**
 * Rouvrir une dépense validée, pour la rattraper après coup.
 *
 * Son versement **rentre** alors en caisse (voir `DepensesRepository`) : une
 * dépense en attente n'a rien coûté, et c'est ce qui permet de la corriger ou
 * de la refuser sans rien contre-passer. Même règle que pour une vente
 * validée, dans l'autre sens.
 *
 * Une dépense **refusée** ne se rouvre pas : elle n'a jamais rien sorti de la
 * caisse, et son refus est une décision, pas un verrou. Qui change d'avis
 * engage la dépense de nouveau — le motif du refus reste au dossier.
 */
export const depenseRouvrable = (statut: StatutDepense | null | undefined): boolean => statut === 'VALIDEE';

/** Une dépense ne se refuse que tant qu'elle attend. */
export const depenseRefusable = (statut: StatutDepense | null | undefined): boolean => statut === 'EN_ATTENTE';

const nombre = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const texte = (v: string | null | undefined): string | null => (v && v.trim() !== '' ? v : null);

export function depenseFromRow(row: DepenseRow): Depense {
  return {
    id: row.id,
    numero: row.numero ?? '',
    filiale_id: row.filiale_id ?? '',
    caisse_id: row.caisse_id ?? '',
    categorie: row.categorie ?? '',
    montant: arrondirFcfa(nombre(row.montant)),
    beneficiaire: texte(row.beneficiaire),
    description: texte(row.description),
    reference: texte(row.reference),
    date_depense: row.date_depense ?? '',
    statut: (row.statut ?? 'EN_ATTENTE') as StatutDepense,
    motif_refus: texte(row.motif_refus),
    utilisateur_id: row.utilisateur_id,
    valide_par: row.valide_par,
    date_validation: row.date_validation,
    notes: texte(row.notes),
  };
}

/**
 * Saisie d'une dépense. Le bénéficiaire est obligatoire : une sortie d'argent
 * sans destinataire nommé n'est pas justifiable, et c'est la première question
 * que posera celui qui doit l'approuver.
 */
export const depenseSchema = z.object({
  caisse_id: z.string().min(1, 'Caisse obligatoire'),
  categorie: z.string().min(1, 'Catégorie obligatoire'),
  montant: z.coerce.number().positive('Montant > 0'),
  beneficiaire: z.string().trim().min(1, 'Bénéficiaire obligatoire').max(80),
  description: z.string().trim().max(200).optional().default(''),
  reference: z.string().trim().max(60).optional().default(''),
  /** Jour de la dépense, au format `AAAA-MM-JJ` : une facture peut dater d'hier. */
  date_depense: z.string().min(10, 'Date obligatoire'),
});
export type DepenseForm = z.infer<typeof depenseSchema>;
export type DepenseFormInput = z.input<typeof depenseSchema>;

/** Un refus se motive : sans raison, la même demande revient le lendemain. */
export const refusSchema = z.object({
  motif: z.string().trim().min(3, 'Dites pourquoi, en quelques mots').max(200),
});
export type RefusForm = z.infer<typeof refusSchema>;
