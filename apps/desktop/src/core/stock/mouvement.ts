import type { MouvementStockRow, StockRow } from '@quinca/shared-types';
import type { TypeMouvementStock } from '@quinca/shared-types';
import { arrondirMontant } from '../commun/prix';
import { genererNumeroPiece } from '../commun/numerotation';

export interface Stock {
  id: string;
  article_id: string;
  depot_id: string;
  filiale_id: string;
  quantite: number;
  quantite_reservee: number;
  quantite_disponible: number;
  cout_moyen: number;
  date_dernier_mouvement: string | null;
}

export interface MouvementStock {
  id: string;
  article_id: string;
  depot_id: string;
  filiale_id: string;
  type: TypeMouvementStock;
  quantite: number;
  quantite_avant: number;
  quantite_apres: number;
  cout_unitaire: number | null;
  reference: string | null;
  motif: string | null;
  utilisateur_id: string | null;
  created_at: string;
}

export function stockFromRow(row: StockRow): Stock {
  return {
    id: row.id,
    article_id: row.article_id ?? '',
    depot_id: row.depot_id ?? '',
    filiale_id: row.filiale_id ?? '',
    quantite: row.quantite ?? 0,
    quantite_reservee: row.quantite_reservee ?? 0,
    quantite_disponible: row.quantite_disponible ?? 0,
    cout_moyen: row.cout_moyen ?? 0,
    date_dernier_mouvement: row.date_dernier_mouvement,
  };
}

export function mouvementFromRow(row: MouvementStockRow): MouvementStock {
  return {
    id: row.id,
    article_id: row.article_id ?? '',
    depot_id: row.depot_id ?? '',
    filiale_id: row.filiale_id ?? '',
    type: (row.type ?? 'AJUSTEMENT') as TypeMouvementStock,
    quantite: row.quantite ?? 0,
    quantite_avant: row.quantite_avant ?? 0,
    quantite_apres: row.quantite_apres ?? 0,
    cout_unitaire: row.cout_unitaire,
    reference: row.reference,
    motif: row.motif,
    utilisateur_id: row.utilisateur_id,
    created_at: row.created_at ?? '',
  };
}

/** Sens d'un type de mouvement : +1 entrée, -1 sortie, 0 = fixe la quantité (inventaire). */
export const SENS_MOUVEMENT: Record<TypeMouvementStock, 1 | -1 | 0> = {
  ENTREE_ACHAT: 1,
  RETOUR_CLIENT: 1,
  TRANSFERT_ENTREE: 1,
  SORTIE_VENTE: -1,
  SORTIE_DESTOCKAGE: -1,
  TRANSFERT_SORTIE: -1,
  CASSE: -1,
  AJUSTEMENT: 1, // signe porté par la quantité (peut être négative)
  INVENTAIRE: 0,
};

export const LIBELLES_MOUVEMENT: Record<TypeMouvementStock, string> = {
  ENTREE_ACHAT: 'Entrée achat',
  RETOUR_CLIENT: 'Retour client',
  TRANSFERT_ENTREE: 'Transfert (entrée)',
  SORTIE_VENTE: 'Sortie vente',
  SORTIE_DESTOCKAGE: 'Déstockage',
  TRANSFERT_SORTIE: 'Transfert (sortie)',
  CASSE: 'Casse / perte',
  AJUSTEMENT: 'Ajustement',
  INVENTAIRE: 'Inventaire',
};

export class StockInsuffisantError extends Error {
  constructor(
    public readonly articleId: string,
    public readonly disponible: number,
    public readonly demande: number,
  ) {
    super(`Stock insuffisant : ${disponible} disponible(s), ${demande} demandé(s)`);
    this.name = 'StockInsuffisantError';
  }
}

export interface EtatStock {
  quantite: number;
  quantite_reservee: number;
  cout_moyen: number;
}

export interface ResultatMouvement {
  quantite_avant: number;
  quantite_apres: number;
  /** Quantité réellement mouvementée, toujours positive (sauf ajustement négatif). */
  quantite: number;
  cout_moyen: number;
}

export const STOCK_VIDE: EtatStock = { quantite: 0, quantite_reservee: 0, cout_moyen: 0 };

/**
 * Applique un mouvement à un état de stock et retourne le nouvel état.
 *
 * - Entrées : coût moyen pondéré recalculé si un coût unitaire est fourni.
 * - Sorties : refusées si la quantité disponible (quantité − réservée) est insuffisante,
 *   sauf `autoriserNegatif` (ajustements assumés).
 * - Inventaire : `quantite` est la quantité comptée ; le mouvement enregistre l'écart.
 */
export function appliquerMouvement(
  etat: EtatStock,
  type: TypeMouvementStock,
  quantite: number,
  coutUnitaire: number | null = null,
  options: { autoriserNegatif?: boolean; articleId?: string } = {},
): ResultatMouvement {
  if (!Number.isFinite(quantite)) throw new Error('Quantité invalide');
  if (type !== 'AJUSTEMENT' && quantite < 0) throw new Error('La quantité doit être positive');
  if (type !== 'INVENTAIRE' && quantite === 0) throw new Error('La quantité doit être différente de zéro');

  const avant = etat.quantite;
  let apres: number;
  let coutMoyen = etat.cout_moyen;

  switch (SENS_MOUVEMENT[type]) {
    case 1: {
      apres = avant + quantite;
      if (quantite > 0 && coutUnitaire != null && coutUnitaire >= 0) {
        coutMoyen = calculerCoutMoyenPondere(avant, etat.cout_moyen, quantite, coutUnitaire);
      }
      break;
    }
    case -1: {
      const disponible = avant - etat.quantite_reservee;
      if (quantite > disponible && !options.autoriserNegatif) {
        throw new StockInsuffisantError(options.articleId ?? '', disponible, quantite);
      }
      apres = avant - quantite;
      break;
    }
    case 0: {
      apres = quantite;
      break;
    }
  }

  return {
    quantite_avant: avant,
    quantite_apres: apres,
    quantite: type === 'INVENTAIRE' ? apres - avant : quantite,
    cout_moyen: arrondirMontant(coutMoyen),
  };
}

export function calculerCoutMoyenPondere(qteAvant: number, coutAvant: number, qteEntree: number, coutEntree: number): number {
  const base = Math.max(qteAvant, 0);
  if (base + qteEntree <= 0) return coutEntree;
  return (base * coutAvant + qteEntree * coutEntree) / (base + qteEntree);
}

export type StatutStock = 'RUPTURE' | 'FAIBLE' | 'OK' | 'SURSTOCK';

export function statutStock(quantite: number, stockMin: number, stockMax: number): StatutStock {
  if (quantite <= 0) return 'RUPTURE';
  if (quantite <= stockMin) return 'FAIBLE';
  if (stockMax > 0 && quantite > stockMax) return 'SURSTOCK';
  return 'OK';
}

/** Numéro de bon de stock, ex. `ENT-20260916-K7Q2` (voir {@link genererNumeroPiece}). */
export const genererNumeroBon = genererNumeroPiece;
