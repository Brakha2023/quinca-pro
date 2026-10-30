import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { LigneTransfertStockRow, MouvementStockRow, TransfertStockRow, TypeMouvementStock } from '@quinca/shared-types';
import { construireBon, resumeBon, type BonStockRow, type LigneTransfertStock, type TransfertStockVue } from '../../../core/stock';
import {
  bonsStockQuery,
  mouvementsQuery,
  stocksParArticleQuery,
  stocksQuery,
  type FiltresAlertes,
  type FiltresBons,
  type FiltresMouvements,
  type FiltresStock,
  type StockVueRow,
} from '../../../infrastructure/powersync/repositories/StockRepository';
import {
  LIGNES_TRANSFERT_QUERY,
  transfertsStockQuery,
  type FiltresTransfertsStock,
} from '../../../infrastructure/powersync/repositories/TransfertsStockRepository';

export interface StockParArticle {
  article_id: string;
  code: string;
  designation: string;
  unite: string;
  prix_achat: number;
  stock_min: number;
  stock_max: number;
  famille_nom: string | null;
  quantite: number;
  valeur: number;
}

export interface MouvementVue extends MouvementStockRow {
  article_code: string | null;
  article_designation: string | null;
  article_unite: string | null;
  depot_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
  fournisseur_nom: string | null;
}

export function useStocks(filialeId: string | null, filtres: FiltresStock = {}) {
  const { sql, params } = useMemo(
    () => stocksQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.depotId, filtres.recherche, filtres.alertesSeulement],
  );
  const { data, isLoading } = useQuery<StockVueRow>(sql, params);
  return { stocks: data, isLoading };
}

export function useStocksParArticle(filialeId: string | null, filtres: FiltresAlertes = {}) {
  const { sql, params } = useMemo(
    () => stocksParArticleQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.depotId, filtres.familleId, filtres.recherche],
  );
  const { data, isLoading } = useQuery<StockParArticle>(sql, params);
  return { lignes: data, isLoading };
}

export function useMouvements(filialeId: string | null, filtres: FiltresMouvements = {}) {
  const { sql, params } = useMemo(
    () => mouvementsQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.depotId, filtres.articleId, filtres.fournisseurId, filtres.type, filtres.reference, filtres.limite],
  );
  const { data, isLoading } = useQuery<MouvementVue>(sql, params);
  return { mouvements: data, isLoading };
}

/** Les bons déjà enregistrés par un onglet de saisie, les plus récents d'abord. */
export function useBonsStock(filialeId: string | null, filtres: FiltresBons) {
  const { sql, params } = useMemo(
    () => bonsStockQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.types, filtres.depotId, filtres.recherche, filtres.debut, filtres.fin, filtres.limite],
  );
  const { data, isLoading } = useQuery<BonStockRow>(sql, params);
  const bons = useMemo(() => data.map(resumeBon), [data]);
  return { bons, isLoading };
}

/** Quantité en stock d'un article dans un dépôt (0 si aucune ligne). */
export function useStockArticleDepot(articleId: string | null, depotId: string | null) {
  const { data } = useQuery<{ quantite: number; quantite_disponible: number; cout_moyen: number }>(
    'SELECT quantite, quantite_disponible, cout_moyen FROM stocks WHERE article_id = ? AND depot_id = ?',
    [articleId ?? '', depotId ?? ''],
  );
  return data[0] ?? { quantite: 0, quantite_disponible: 0, cout_moyen: 0 };
}

/** Bon imprimable : tous les mouvements portant la même référence, remis en forme. */
export function useBonStock(filialeId: string | null, reference: string | null) {
  const { sql, params } = useMemo(
    () => mouvementsQuery(filialeId, { reference, limite: 500 }),
    [filialeId, reference],
  );
  const { data } = useQuery<MouvementVue>(sql, params);
  return useMemo(
    () =>
      reference
        ? construireBon(
            reference,
            data.map((m) => ({
              id: m.id,
              type: (m.type ?? 'AJUSTEMENT') as TypeMouvementStock,
              article_code: m.article_code ?? '',
              article_designation: m.article_designation ?? '',
              article_unite: m.article_unite ?? '',
              depot_nom: m.depot_nom ?? '',
              quantite: m.quantite ?? 0,
              quantite_avant: m.quantite_avant ?? 0,
              quantite_apres: m.quantite_apres ?? 0,
              cout_unitaire: m.cout_unitaire,
              remise_percent: m.remise_percent ?? 0,
              motif: m.motif,
              fournisseur_nom: m.fournisseur_nom,
              utilisateur: [m.utilisateur_prenom, m.utilisateur_nom].filter(Boolean).join(' '),
              created_at: m.created_at ?? '',
            })),
          )
        : null,
    [reference, data],
  );
}

/** Ligne de la liste des transferts entre filiales : l'en-tête, noms joints. */
export interface TransfertStockRowVue extends TransfertStockRow {
  filiale_source_nom: string | null;
  filiale_destination_nom: string | null;
  depot_source_nom: string | null;
  depot_destination_nom: string | null;
  envoi_nom: string | null;
  envoi_prenom: string | null;
  reception_nom: string | null;
  reception_prenom: string | null;
}

const nomComplet = (prenom: string | null, nom: string | null) => [prenom, nom].filter(Boolean).join(' ') || null;

function versVue(row: TransfertStockRowVue): TransfertStockVue {
  return {
    id: row.id,
    numero: row.numero ?? '',
    statut: (row.statut ?? 'EN_TRANSIT') as TransfertStockVue['statut'],
    filiale_source_id: row.filiale_source_id ?? '',
    filiale_destination_id: row.filiale_destination_id ?? '',
    filiale_source_nom: row.filiale_source_nom,
    filiale_destination_nom: row.filiale_destination_nom,
    depot_source_nom: row.depot_source_nom,
    depot_destination_nom: row.depot_destination_nom,
    motif: row.motif,
    transporteur: row.transporteur,
    nombre_lignes: row.nombre_lignes ?? 0,
    quantite_totale: row.quantite_totale ?? 0,
    valeur_totale: row.valeur_totale ?? 0,
    date_envoi: row.date_envoi ?? '',
    date_reception: row.date_reception,
    utilisateur_envoi: nomComplet(row.envoi_prenom, row.envoi_nom),
    utilisateur_reception: nomComplet(row.reception_prenom, row.reception_nom),
  };
}

/** Transferts entre filiales où la filiale est partie prenante, dans les deux sens. */
export function useTransfertsStock(filialeId: string | null, filtres: FiltresTransfertsStock = {}) {
  const { sql, params } = useMemo(
    () => transfertsStockQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.debut, filtres.fin, filtres.sens, filtres.filialeId, filtres.statut, filtres.limite],
  );
  const { data, isLoading } = useQuery<TransfertStockRowVue>(sql, params);
  const transferts = useMemo(() => data.map(versVue), [data]);
  return { transferts, isLoading };
}

/** Lignes d'un bon de transfert : le détail de la marchandise. */
export function useLignesTransfert(transfertId: string | null) {
  const { data } = useQuery<LigneTransfertStockRow>(LIGNES_TRANSFERT_QUERY, [transfertId ?? '']);
  return useMemo<LigneTransfertStock[]>(
    () =>
      data.map((l) => ({
        id: l.id,
        code: l.code ?? '',
        designation: l.designation ?? '',
        unite: l.unite ?? 'PIECE',
        quantite: l.quantite ?? 0,
        cout_unitaire: l.cout_unitaire ?? 0,
        prix_vente: l.prix_vente ?? 0,
        montant: l.montant ?? 0,
      })),
    [data],
  );
}
