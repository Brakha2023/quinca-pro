import { z } from 'zod';
import type { StatutTransfertFiliale } from '@quinca/shared-types';
import { arrondirFcfa, arrondirMontant } from '../commun/prix';

/**
 * Transfert de marchandise entre filiales.
 *
 * À la différence du transfert entre dépôts d'une même filiale — une sortie et
 * une entrée dans la même écriture —, la marchandise reste ici plusieurs
 * heures ou plusieurs jours sur la route. Pendant ce temps elle n'est dans
 * aucun dépôt, et c'est le bon de transfert qui en répond : l'expéditeur sort
 * la marchandise à l'envoi, le destinataire la fait entrer à l'arrivée, dans
 * le dépôt de son choix.
 *
 * Deux raisons techniques l'imposent, et elles vont dans le même sens que le
 * métier : un poste ne synchronise que le stock de ses filiales, et la RLS lui
 * refuserait d'écrire dans celui d'une autre.
 */

export type StatutTransfertStock = StatutTransfertFiliale;

export const LIBELLES_STATUT_TRANSFERT_STOCK: Record<StatutTransfertStock, string> = {
  EN_TRANSIT: 'En transit',
  RECU: 'Reçu',
  ANNULE: 'Annulé',
};

export const STATUTS_FILTRE_TRANSFERT: Array<{ id: '' | StatutTransfertStock; label: string }> = [
  { id: '', label: 'Tous les statuts' },
  { id: 'EN_TRANSIT', label: 'En transit' },
  { id: 'RECU', label: 'Reçus' },
  { id: 'ANNULE', label: 'Annulés' },
];

export const transfertFilialeStockSchema = z.object({
  filiale_destination_id: z.string().min(1, 'Filiale destinataire obligatoire'),
  depot_source_id: z.string().min(1, 'Dépôt de départ obligatoire'),
  numero: z.string().trim().max(40).optional().default(''),
  motif: z.string().trim().max(200).optional().default(''),
  transporteur: z.string().trim().max(120).optional().default(''),
  lignes: z
    .array(z.object({ article_id: z.string().min(1), quantite: z.coerce.number().positive('Quantité > 0') }))
    .min(1, 'Au moins une ligne'),
});
export type TransfertFilialeStock = z.infer<typeof transfertFilialeStockSchema>;

/** En-tête d'un transfert, tel qu'il est relu par les écrans (noms joints). */
export interface TransfertStockVue {
  id: string;
  numero: string;
  statut: StatutTransfertStock;
  filiale_source_id: string;
  filiale_destination_id: string;
  filiale_source_nom: string | null;
  filiale_destination_nom: string | null;
  depot_source_nom: string | null;
  depot_destination_nom: string | null;
  motif: string | null;
  transporteur: string | null;
  nombre_lignes: number;
  quantite_totale: number;
  valeur_totale: number;
  date_envoi: string;
  date_reception: string | null;
  utilisateur_envoi: string | null;
  utilisateur_reception: string | null;
}

export interface LigneTransfertStock {
  id: string;
  code: string;
  designation: string;
  unite: string;
  quantite: number;
  cout_unitaire: number;
  prix_vente: number;
  montant: number;
}

/** Ce que l'expéditeur écrit sur la pièce : totaux repris en tête du bon. */
export function totauxTransfert(lignes: ReadonlyArray<Pick<LigneTransfertStock, 'quantite' | 'cout_unitaire'>>) {
  return {
    nombre_lignes: lignes.length,
    quantite_totale: arrondirMontant(lignes.reduce((t, l) => t + l.quantite, 0)),
    valeur_totale: arrondirFcfa(lignes.reduce((t, l) => t + l.quantite * l.cout_unitaire, 0)),
  };
}

/** Qui peut agir : l'expéditeur annule tant que c'est en route, le destinataire réceptionne. */
export function roleTransfertStock(
  t: Pick<TransfertStockVue, 'filiale_source_id' | 'filiale_destination_id'>,
  filialeId: string,
): 'EXPEDITEUR' | 'DESTINATAIRE' | 'TIERS' {
  if (t.filiale_source_id === filialeId) return 'EXPEDITEUR';
  if (t.filiale_destination_id === filialeId) return 'DESTINATAIRE';
  return 'TIERS';
}

export const transfertReceptionnable = (t: Pick<TransfertStockVue, 'statut' | 'filiale_source_id' | 'filiale_destination_id'>, filialeId: string): boolean =>
  t.statut === 'EN_TRANSIT' && roleTransfertStock(t, filialeId) === 'DESTINATAIRE';

export const transfertAnnulable = (t: Pick<TransfertStockVue, 'statut' | 'filiale_source_id' | 'filiale_destination_id'>, filialeId: string): boolean =>
  t.statut === 'EN_TRANSIT' && roleTransfertStock(t, filialeId) === 'EXPEDITEUR';

export interface RecapTransfertsStock {
  nombre: number;
  en_transit: number;
  recus: number;
  annules: number;
  quantite: number;
  /** Valeur des transferts qui comptent : un transfert annulé n'a rien déplacé. */
  valeur: number;
  /** Valeur encore sur la route : ce qui n'est dans aucun dépôt ce soir. */
  valeur_en_transit: number;
}

export function recapTransfertsStock(liste: readonly TransfertStockVue[]): RecapTransfertsStock {
  const vivants = liste.filter((t) => t.statut !== 'ANNULE');
  const enTransit = liste.filter((t) => t.statut === 'EN_TRANSIT');
  return {
    nombre: liste.length,
    en_transit: enTransit.length,
    recus: liste.filter((t) => t.statut === 'RECU').length,
    annules: liste.filter((t) => t.statut === 'ANNULE').length,
    quantite: arrondirMontant(vivants.reduce((t, l) => t + l.quantite_totale, 0)),
    valeur: arrondirFcfa(vivants.reduce((t, l) => t + l.valeur_totale, 0)),
    valeur_en_transit: arrondirFcfa(enTransit.reduce((t, l) => t + l.valeur_totale, 0)),
  };
}

export interface FiltresTransfertsStock {
  debut?: string;
  fin?: string;
  sens?: 'TOUS' | 'ENVOIS' | 'RECEPTIONS';
  filialeId?: string | null;
  statut?: '' | StatutTransfertStock;
}

export const SENS_TRANSFERT: Array<{ id: 'TOUS' | 'ENVOIS' | 'RECEPTIONS'; label: string }> = [
  { id: 'TOUS', label: 'Envois et réceptions' },
  { id: 'ENVOIS', label: 'Envois seulement' },
  { id: 'RECEPTIONS', label: 'Réceptions seulement' },
];

/** Filtres en vigueur, en une phrase : ce qui est écrit sur le document et l'export. */
export function perimetreTransfertsStock(filtres: FiltresTransfertsStock & { filialeNom?: string | null }): string {
  const periode = filtres.debut || filtres.fin
    ? `du ${filtres.debut || '…'} au ${filtres.fin || '…'}`
    : 'toutes périodes';
  return [
    SENS_TRANSFERT.find((s) => s.id === (filtres.sens ?? 'TOUS'))?.label ?? '',
    periode,
    filtres.filialeNom ? `filiale « ${filtres.filialeNom} »` : 'toutes filiales',
    filtres.statut ? LIBELLES_STATUT_TRANSFERT_STOCK[filtres.statut] : 'tous statuts',
  ].filter(Boolean).join(' · ');
}

/** Bon de transfert prêt à imprimer : en-tête, lignes valorisées, totaux. */
export interface BonTransfertFiliale {
  numero: string;
  statut: StatutTransfertStock;
  date_envoi: string;
  date_reception: string | null;
  filiale_source: string;
  filiale_destination: string;
  depot_source: string;
  depot_destination: string | null;
  motif: string | null;
  transporteur: string | null;
  operateur: string;
  receptionnaire: string | null;
  lignes: LigneTransfertStock[];
  quantite_totale: number;
  valeur_totale: number;
}

/**
 * Le bon se reconstruit des lignes, pas des totaux stockés en tête : s'ils
 * divergeaient, c'est la liste des articles qui fait foi devant le chauffeur.
 */
export function construireBonTransfert(entete: TransfertStockVue, lignes: readonly LigneTransfertStock[]): BonTransfertFiliale {
  const totaux = totauxTransfert(lignes);
  return {
    numero: entete.numero,
    statut: entete.statut,
    date_envoi: entete.date_envoi,
    date_reception: entete.date_reception,
    filiale_source: entete.filiale_source_nom ?? '—',
    filiale_destination: entete.filiale_destination_nom ?? '—',
    depot_source: entete.depot_source_nom ?? '—',
    depot_destination: entete.depot_destination_nom,
    motif: entete.motif,
    transporteur: entete.transporteur,
    operateur: entete.utilisateur_envoi ?? '—',
    receptionnaire: entete.utilisateur_reception,
    lignes: [...lignes],
    quantite_totale: totaux.quantite_totale,
    valeur_totale: totaux.valeur_totale,
  };
}
