import { arrondirFcfa, arrondirMontant, prixHtDepuisTtc } from '../commun/prix';
import { calculerLigne, type LignePanier } from './panier';
import type { LigneVente, VentePreparee } from './vente';

/** Sortie papier d'une vente : ticket de caisse 80 mm ou facture A4. */
export type FormatImpression = 'TICKET' | 'A4';

export const FORMATS_IMPRESSION: Array<{ id: FormatImpression; label: string; aide: string }> = [
  { id: 'TICKET', label: 'Ticket 80 mm', aide: 'Imprimante thermique de caisse' },
  { id: 'A4', label: 'Facture A4', aide: 'Imprimante bureautique' },
];

export const estFormatImpression = (v: unknown): v is FormatImpression => v === 'TICKET' || v === 'A4';

/** Ligne telle qu'elle s'imprime sur la facture : tout en HT, remise en montant. */
export interface LigneFacture {
  code: string;
  designation: string;
  quantite: number;
  prix_unitaire_ht: number;
  /** Remise de ligne en montant HT (la facture affiche des francs, pas des pourcentages). */
  remise: number;
  total_ht: number;
  tva: number;
  depot: string;
}

export function lignesFacture(lignes: LignePanier[], depot: string): LigneFacture[] {
  return lignes.map((ligne) => {
    const calculee = calculerLigne(ligne);
    const brutHt = arrondirMontant(prixHtDepuisTtc(ligne.prix_unitaire_ttc, ligne.tva_percent) * ligne.quantite);
    return {
      code: ligne.code,
      designation: ligne.designation,
      quantite: ligne.quantite,
      prix_unitaire_ht: calculee.prix_unitaire_ht,
      remise: arrondirMontant(brutHt - calculee.total_ht),
      total_ht: calculee.total_ht,
      tva: arrondirMontant(calculee.total_ttc - calculee.total_ht),
      depot,
    };
  });
}

/** Pied de facture : ce qui a été payé, ce qui reste dû, et le détail des montants. */
export interface RecapFacture {
  montant_paye: number;
  reste_a_payer: number;
  /** Avance disponible du client au moment de la vente. */
  avoir: number;
  brut_ht: number;
  remise: number;
  net_ht: number;
  tva: number;
  net_a_payer: number;
  /** Vente soldée à la caisse : aucun reste à payer. */
  comptant: boolean;
}

/**
 * Montant payé = ce qui entre réellement en caisse (le rendu de monnaie
 * n'est pas un encaissement). Une vente à crédit laisse un reste à payer.
 */
export function recapFacture(preparee: VentePreparee, avoir = 0): RecapFacture {
  const t = preparee.totaux;
  return {
    montant_paye: preparee.montant_encaisse,
    reste_a_payer: preparee.reste_a_payer,
    avoir,
    brut_ht: t.total_brut_ht,
    remise: t.total_remise,
    net_ht: t.total_net_ht,
    tva: t.total_tva,
    net_a_payer: t.total_ttc,
    comptant: preparee.reste_a_payer === 0,
  };
}

/** Avance du client : un solde négatif est un acompte à son crédit. */
export function avoirClient(client: { solde_actuel: number } | null): number {
  return client && client.solde_actuel < 0 ? Math.abs(client.solde_actuel) : 0;
}

/** Vente déjà enregistrée, telle qu'on la relit pour rééditer sa facture. */
export interface VenteEnregistree {
  total_brut_ht: number | null;
  total_remise: number | null;
  total_net_ht: number | null;
  total_tva: number | null;
  total_ttc: number | null;
  montant_percu: number | null;
  monnaie: number | null;
  reste_a_payer: number | null;
}

/** Même pied de facture, reconstruit depuis la vente stockée (réimpression). */
export function recapVenteEnregistree(vente: VenteEnregistree, avoir = 0): RecapFacture {
  const reste = vente.reste_a_payer ?? 0;
  return {
    montant_paye: arrondirFcfa((vente.montant_percu ?? 0) - (vente.monnaie ?? 0)),
    reste_a_payer: reste,
    avoir,
    brut_ht: vente.total_brut_ht ?? 0,
    remise: vente.total_remise ?? 0,
    net_ht: vente.total_net_ht ?? 0,
    tva: vente.total_tva ?? 0,
    net_a_payer: vente.total_ttc ?? 0,
    comptant: reste === 0,
  };
}

/**
 * Lignes de facture d'une vente stockée. Les montants ne sont pas recalculés :
 * une facture rééditée doit porter les mêmes chiffres que l'originale, même si
 * le tarif de l'article a changé depuis.
 */
export function lignesFactureDepuisVente(lignes: LigneVente[], nomDepot: (id: string | null) => string): LigneFacture[] {
  return lignes.map((l) => ({
    code: l.code_article,
    designation: l.designation,
    quantite: l.quantite,
    prix_unitaire_ht: l.prix_unitaire_ht,
    remise: arrondirMontant(l.prix_unitaire_ht * l.quantite - l.total_ht),
    total_ht: l.total_ht,
    tva: arrondirMontant(l.total_ttc - l.total_ht),
    depot: nomDepot(l.depot_id),
  }));
}
