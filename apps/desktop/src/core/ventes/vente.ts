import { z } from 'zod';
import { MODES_PAIEMENT, type LigneVenteRow, type ModePaiement, type StatutVente, type VenteRow } from '@quinca/shared-types';
import { peutVendreACredit, type Client } from '../clients';
import { arrondirMontant } from '../commun/prix';
import { genererNumeroPiece } from '../commun/numerotation';
import { calculerTotaux, type LignePanier, type TotauxPanier } from './panier';

export const LIBELLES_MODE_PAIEMENT: Record<ModePaiement, string> = {
  ESPECES: 'Espèces',
  MOBILE_MONEY: 'Mobile money',
  CHEQUE: 'Chèque',
  CREDIT: 'Crédit client',
};

export const LIBELLES_STATUT_VENTE: Record<StatutVente, string> = {
  EN_ATTENTE: 'En attente',
  VALIDEE: 'Validée',
  ANNULEE: 'Annulée',
};

/** Modes qui alimentent physiquement la caisse. */
export const MODES_EN_CAISSE: ReadonlySet<ModePaiement> = new Set(['ESPECES', 'MOBILE_MONEY']);

export const paiementSchema = z.object({
  mode_paiement: z.enum(MODES_PAIEMENT),
  /** Montant remis par le client (espèces) ou encaissé (autres modes). Ignoré pour CREDIT. */
  montant_percu: z.coerce.number().min(0).default(0),
});
export type Paiement = z.infer<typeof paiementSchema>;

export const livraisonDemandeSchema = z.object({
  adresse_livraison: z.string().trim().min(1, 'Adresse de livraison obligatoire').max(200),
  date_livraison_prevue: z.string().min(1, 'Date prévue obligatoire'),
  chauffeur: z.string().trim().max(60).optional().default(''),
  vehicule: z.string().trim().max(40).optional().default(''),
});
export type LivraisonDemande = z.infer<typeof livraisonDemandeSchema>;

export interface VenteAEnregistrer {
  lignes: LignePanier[];
  remise_globale_percent: number;
  client: Client | null;
  paiement: Paiement;
  livraison: LivraisonDemande | null;
  notes: string;
}

export interface VentePreparee {
  numero: string;
  totaux: TotauxPanier;
  mode_paiement: ModePaiement;
  montant_percu: number;
  /** Ce qui reste dû par le client (créance) après encaissement. */
  reste_a_payer: number;
  /** Rendu au client (espèces uniquement). */
  monnaie: number;
  /** Montant réellement encaissé (perçu − monnaie). */
  montant_encaisse: number;
}

export class VenteInvalideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VenteInvalideError';
  }
}

/**
 * Applique les règles de caisse et prépare les montants de la vente.
 *
 * - Espèces : le montant remis doit couvrir le total, la monnaie est rendue.
 * - Chèque / mobile money : montant perçu ≤ total ; le reste devient une créance
 *   (client en compte obligatoire).
 * - Crédit : rien n'est perçu ; la créance doit rester dans le plafond du client.
 */
export function preparerVente(vente: VenteAEnregistrer, codeCaisse: string, date: Date = new Date()): VentePreparee {
  if (vente.lignes.length === 0) throw new VenteInvalideError('Le ticket est vide');
  if (vente.lignes.some((l) => l.quantite <= 0)) throw new VenteInvalideError('Quantité invalide sur une ligne');

  const totaux = calculerTotaux(vente.lignes, vente.remise_globale_percent);
  if (totaux.total_ttc <= 0) throw new VenteInvalideError('Le total de la vente doit être positif');

  const { mode_paiement } = vente.paiement;
  let montantPercu = arrondirMontant(vente.paiement.montant_percu);
  let monnaie = 0;

  if (mode_paiement === 'CREDIT') {
    montantPercu = 0;
  } else if (mode_paiement === 'ESPECES') {
    if (montantPercu < totaux.total_ttc) throw new VenteInvalideError('Montant remis insuffisant');
    monnaie = arrondirMontant(montantPercu - totaux.total_ttc);
  } else if (montantPercu > totaux.total_ttc) {
    throw new VenteInvalideError('Le montant perçu dépasse le total');
  }

  const montantEncaisse = arrondirMontant(montantPercu - monnaie);
  const reste = arrondirMontant(totaux.total_ttc - montantEncaisse);

  if (reste > 0) {
    if (!vente.client) throw new VenteInvalideError('Un client en compte est requis pour une vente à crédit ou partielle');
    if (!vente.client.est_actif) throw new VenteInvalideError('Client inactif');
    if (!peutVendreACredit(vente.client, reste)) {
      throw new VenteInvalideError(`Plafond de crédit dépassé (disponible : ${Math.max(vente.client.plafond_credit - vente.client.solde_actuel, 0).toLocaleString('fr-FR')} F)`);
    }
  }

  return {
    numero: genererNumeroPiece(codeCaisse, date),
    totaux,
    mode_paiement,
    montant_percu: montantPercu,
    reste_a_payer: reste,
    monnaie,
    montant_encaisse: montantEncaisse,
  };
}

export interface Vente {
  id: string;
  numero: string;
  date_vente: string;
  client_id: string | null;
  utilisateur_id: string | null;
  caisse_id: string | null;
  filiale_id: string;
  total_brut_ht: number;
  total_remise: number;
  total_net_ht: number;
  total_tva: number;
  total_ttc: number;
  montant_percu: number;
  reste_a_payer: number;
  monnaie: number;
  mode_paiement: ModePaiement;
  statut: StatutVente;
  notes: string | null;
}

export function venteFromRow(row: VenteRow): Vente {
  return {
    id: row.id,
    numero: row.numero ?? '',
    date_vente: row.date_vente ?? '',
    client_id: row.client_id,
    utilisateur_id: row.utilisateur_id,
    caisse_id: row.caisse_id,
    filiale_id: row.filiale_id ?? '',
    total_brut_ht: row.total_brut_ht ?? 0,
    total_remise: row.total_remise ?? 0,
    total_net_ht: row.total_net_ht ?? 0,
    total_tva: row.total_tva ?? 0,
    total_ttc: row.total_ttc ?? 0,
    montant_percu: row.montant_percu ?? 0,
    reste_a_payer: row.reste_a_payer ?? 0,
    monnaie: row.monnaie ?? 0,
    mode_paiement: (row.mode_paiement ?? 'ESPECES') as ModePaiement,
    statut: (row.statut ?? 'EN_ATTENTE') as StatutVente,
    notes: row.notes,
  };
}

export interface LigneVente {
  id: string;
  vente_id: string;
  article_id: string | null;
  code_article: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  prix_unitaire_ttc: number;
  remise_percent: number;
  tva_percent: number;
  total_ht: number;
  total_ttc: number;
}

export function ligneVenteFromRow(row: LigneVenteRow): LigneVente {
  return {
    id: row.id,
    vente_id: row.vente_id ?? '',
    article_id: row.article_id,
    code_article: row.code_article ?? '',
    designation: row.designation ?? '',
    quantite: row.quantite ?? 0,
    prix_unitaire_ht: row.prix_unitaire_ht ?? 0,
    prix_unitaire_ttc: row.prix_unitaire_ttc ?? 0,
    remise_percent: row.remise_percent ?? 0,
    tva_percent: row.tva_percent ?? 0,
    total_ht: row.total_ht ?? 0,
    total_ttc: row.total_ttc ?? 0,
  };
}
