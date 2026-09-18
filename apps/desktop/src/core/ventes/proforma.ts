import { z } from 'zod';
import type { LigneProformaRow, ProformaRow, StatutProforma } from '@quinca/shared-types';
import { calculerTotaux, type LignePanier } from './panier';

export const LIBELLES_STATUT_PROFORMA: Record<StatutProforma, string> = { EN_COURS: 'En cours', FACTUREE: 'Facturée', ANNULEE: 'Annulée' };

/** Proforma (devis) : mêmes lignes qu'un ticket, sans stock ni caisse tant qu'elle n'est pas facturée. */
export const proformaSchema = z
  .object({
    client_id: z.string().optional().default(''),
    client_nom: z.string().trim().max(120).optional().default(''),
    numero: z.string().trim().max(40).optional().default(''),
    date_validite: z.string().optional().default(''),
    remise_percent: z.coerce.number().min(0).max(100).default(0),
    notes: z.string().trim().max(500).optional().default(''),
    lignes: z
      .array(z.object({
        article_id: z.string().min(1),
        code: z.string(),
        designation: z.string().min(1),
        unite: z.string().default('PIECE'),
        prix_unitaire_ttc: z.coerce.number().min(0, 'Prix ≥ 0'),
        tva_percent: z.coerce.number().min(0).max(100).default(0),
        quantite: z.coerce.number().positive('Quantité > 0'),
        remise_percent: z.coerce.number().min(0).max(100).default(0),
      }))
      .min(1, 'Au moins une ligne'),
  })
  .refine((p) => p.client_id || p.client_nom, { message: 'Client en compte ou nom du client obligatoire', path: ['client_nom'] });
export type ProformaForm = z.infer<typeof proformaSchema>;

export const totauxProforma = (p: Pick<ProformaForm, 'lignes' | 'remise_percent'>) => calculerTotaux(p.lignes, p.remise_percent);

export interface Proforma {
  id: string;
  numero: string;
  client_id: string | null;
  client_nom: string | null;
  date_proforma: string;
  date_validite: string | null;
  statut: StatutProforma;
  remise_percent: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
  vente_id: string | null;
  notes: string | null;
  utilisateur_id: string | null;
}

export function proformaFromRow(row: ProformaRow): Proforma {
  return {
    id: row.id, numero: row.numero ?? '', client_id: row.client_id, client_nom: row.client_nom, date_proforma: row.date_proforma ?? '', date_validite: row.date_validite,
    statut: (row.statut ?? 'EN_COURS') as StatutProforma, remise_percent: row.remise_percent ?? 0, total_ht: row.total_ht ?? 0, total_tva: row.total_tva ?? 0,
    total_ttc: row.total_ttc ?? 0, vente_id: row.vente_id, notes: row.notes, utilisateur_id: row.utilisateur_id,
  };
}

/** Ligne de proforma remise sous la forme d'une ligne de ticket (pour la facturer au point de vente). */
export function ligneProformaVersPanier(row: LigneProformaRow): LignePanier {
  return {
    article_id: row.article_id ?? '', code: row.code_article ?? '', designation: row.designation ?? '', unite: row.unite ?? 'PIECE',
    prix_unitaire_ttc: row.prix_unitaire_ttc ?? 0, tva_percent: row.tva_percent ?? 0, quantite: row.quantite ?? 0, remise_percent: row.remise_percent ?? 0,
  };
}
