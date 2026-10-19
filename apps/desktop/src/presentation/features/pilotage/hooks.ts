import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  classement, consolider, indicateurs, repartirParAnciennete, repartitionStock, serieCaMarge,
  type Fenetre, type FactureImpayee, type Indicateurs, type IndicateursBruts, type LigneStockPilotage,
} from '../../../core/pilotage';
import {
  CA_PAR_FAMILLE_QUERY, FACTURES_IMPAYEES_QUERY, INDICATEURS_QUERY, STOCK_PILOTAGE_QUERY, TOP_CLIENTS_QUERY,
  parametresIndicateurs, parametresSerie, serieQuery,
} from '../../../infrastructure/powersync/repositories/PilotageRepository';

/**
 * Le tableau de bord lit la base locale : il fonctionne hors ligne, et se
 * recalcule à chaque vente qui arrive. Un gérant ne voit qu'une filiale — les
 * sync rules s'en chargent —, un directeur les voit toutes.
 */

/** Indicateurs de toutes les filiales visibles sur ce poste. */
export function useIndicateurs(fenetre: Fenetre) {
  const { data, isLoading } = useQuery<IndicateursBruts>(
    INDICATEURS_QUERY,
    parametresIndicateurs(fenetre.debut, fenetre.fin),
  );
  const liste = useMemo(() => data.map(indicateurs), [data]);
  return { liste, isLoading };
}

/**
 * Les chiffres du périmètre regardé : une filiale, ou le groupe entier.
 * `filialeId` nul vaut « tout ce que ce poste reçoit ».
 */
export function usePerimetre(fenetre: Fenetre, filialeId: string | null) {
  const { liste, isLoading } = useIndicateurs(fenetre);
  const retenus = useMemo(
    () => (filialeId ? liste.filter((i) => i.filiale_id === filialeId) : liste),
    [liste, filialeId],
  );
  const total = useMemo<Indicateurs>(
    () => (retenus.length === 1 ? retenus[0]! : consolider(retenus)),
    [retenus],
  );
  return { total, filiales: liste, isLoading };
}

export function useSerieCaMarge(fenetre: Fenetre, filialeId: string | null) {
  const sql = useMemo(() => serieQuery(fenetre.granularite), [fenetre.granularite]);
  const { data } = useQuery<{ cle: string; ca_ht: number; cout: number; ventes: number }>(
    sql,
    parametresSerie(fenetre.debut, fenetre.fin, filialeId),
  );
  return useMemo(() => serieCaMarge(data, fenetre), [data, fenetre]);
}

export function useRepartitionStock(filialeId: string | null) {
  const { data } = useQuery<LigneStockPilotage & { stock_min: number }>(STOCK_PILOTAGE_QUERY, [
    filialeId ?? '', filialeId ?? '',
  ]);
  const lignes = useMemo(
    () => data.map((l) => ({
      article_id: l.article_id, code: l.code, designation: l.designation,
      quantite: l.quantite ?? 0, stock_min: l.stock_min ?? 0, valeur: l.valeur ?? 0,
      dernier_mouvement: l.dernier_mouvement,
    })),
    [data],
  );
  return { repartition: useMemo(() => repartitionStock(lignes), [lignes]), lignes };
}

export function useAncienneteCreances(filialeId: string | null) {
  const { data } = useQuery<FactureImpayee & { date: string }>(FACTURES_IMPAYEES_QUERY, [
    filialeId ?? '', filialeId ?? '',
  ]);
  const factures = useMemo(
    () => data.map((f) => ({ id: f.id, numero: f.numero, client: f.client, date: f.date, reste: f.reste ?? 0 })),
    [data],
  );
  return useMemo(() => repartirParAnciennete(factures), [factures]);
}

export function useCaParFamille(fenetre: Fenetre, filialeId: string | null, limite = 6) {
  const { data } = useQuery<{ cle: string; libelle: string; valeur: number; quantite: number }>(
    CA_PAR_FAMILLE_QUERY,
    [fenetre.debut, fenetre.fin, filialeId ?? '', filialeId ?? ''],
  );
  return useMemo(
    () => classement(data.map((l) => ({ cle: l.cle, libelle: l.libelle, valeur: l.valeur ?? 0 })), limite),
    [data, limite],
  );
}

export function useTopClients(fenetre: Fenetre, filialeId: string | null, limite = 6) {
  const { data } = useQuery<{ cle: string; libelle: string; valeur: number; ventes: number }>(
    TOP_CLIENTS_QUERY,
    [fenetre.debut, fenetre.fin, filialeId ?? '', filialeId ?? ''],
  );
  return useMemo(
    () => classement(
      data.map((l) => ({ cle: l.cle, libelle: l.libelle, valeur: l.valeur ?? 0, detail: `${l.ventes} vente(s)` })),
      limite,
    ),
    [data, limite],
  );
}

export interface TopArticle { code: string; designation: string; quantite: number; ca: number }

export function useTopArticles(fenetre: Fenetre, filialeId: string | null, limite = 5) {
  const { data } = useQuery<TopArticle>(
    `SELECT l.code_article AS code, l.designation, SUM(l.quantite) AS quantite, SUM(l.total_ttc) AS ca
     FROM lignes_vente l JOIN ventes v ON v.id = l.vente_id
     WHERE v.statut != 'ANNULEE' AND v.date_vente BETWEEN ? AND ? AND (? = '' OR v.filiale_id = ?)
     GROUP BY l.code_article, l.designation ORDER BY ca DESC LIMIT ?`,
    [fenetre.debut, fenetre.fin, filialeId ?? '', filialeId ?? '', limite],
  );
  return data;
}

export interface LecturePilotage {
  total: Indicateurs;
  filiales: Indicateurs[];
  serie: ReturnType<typeof useSerieCaMarge>;
  repartition: ReturnType<typeof useRepartitionStock>['repartition'];
  lignesStock: ReturnType<typeof useRepartitionStock>['lignes'];
  anciennete: ReturnType<typeof useAncienneteCreances>;
  familles: ReturnType<typeof useCaParFamille>;
  clients: ReturnType<typeof useTopClients>;
  articles: TopArticle[];
  isLoading: boolean;
}

/**
 * Tout le tableau de bord en une lecture.
 *
 * L'écran et la feuille imprimée affichent **les mêmes chiffres** : ils ne
 * doivent donc pas les lire deux fois. Une seconde lecture repartirait de zéro
 * — les requêtes de PowerSync rendent une première réponse vide — et le
 * document sortirait de l'imprimante avec des colonnes à zéro.
 */
export function useTableauDeBord(fenetre: Fenetre, filialeId: string | null): LecturePilotage {
  const { total, filiales, isLoading } = usePerimetre(fenetre, filialeId);
  const serie = useSerieCaMarge(fenetre, filialeId);
  const { repartition, lignes: lignesStock } = useRepartitionStock(filialeId);
  const anciennete = useAncienneteCreances(filialeId);
  const familles = useCaParFamille(fenetre, filialeId);
  const clients = useTopClients(fenetre, filialeId);
  const articles = useTopArticles(fenetre, filialeId, 6);
  return { total, filiales, serie, repartition, lignesStock, anciennete, familles, clients, articles, isLoading };
}
