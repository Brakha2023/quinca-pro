import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  classement, consolider, debutDesMois, indicateurs, moisGlissants, repartirParAnciennete, repartitionStock,
  serieActiviteTiers, serieCaMarge,
  type Fenetre, type FactureImpayee, type Indicateurs, type IndicateursBruts, type LigneStockPilotage,
  type PointActiviteBrut, type SerieActiviteTiers,
} from '../../../core/pilotage';
import {
  ACTIVITE_CLIENT_QUERY, ACTIVITE_FOURNISSEUR_QUERY, CA_PAR_FAMILLE_QUERY, FACTURES_IMPAYEES_QUERY,
  INDICATEURS_QUERY, STOCK_PILOTAGE_QUERY, TOP_CLIENTS_QUERY, TOP_CREANCES_CLIENTS_QUERY,
  TOP_DETTES_FOURNISSEURS_QUERY, parametresIndicateurs, parametresSerie, serieQuery,
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

/** Un compte et ce qu'il pèse : la ligne d'un classement de soldes. */
export interface TiersEngage {
  id: string;
  nom: string;
  code: string;
  /** Filiale du compte : c'est elle qu'il faut ouvrir pour voir sa fiche. */
  filialeId: string;
  solde: number;
  /** Date d'arrêté du solde repris à la bascule, quand il y en a une. */
  dateEffet: string | null;
}

export interface ClassementTiers {
  tiers: TiersEngage[];
  lignes: ReturnType<typeof classement>['lignes'];
  maximum: number;
  total: number;
}

type LigneTiersBrute = { cle: string; libelle: string | null; code: string | null; filiale_id: string | null; valeur: number | null; date_effet_solde: string | null };

/**
 * Les comptes les plus engagés, rangés par solde décroissant.
 *
 * La queue n'est **pas** repliée en « Autres » : ces lignes se cliquent pour
 * ouvrir un compte, et « Autres » ne désigne personne. La part affichée reste
 * celle du total de tous les comptes, y compris ceux qu'on ne montre pas.
 */
function useTiersEngages(sql: string, filialeId: string | null, limite: number): ClassementTiers {
  const { data } = useQuery<LigneTiersBrute>(sql, [filialeId ?? '', filialeId ?? '', limite]);
  return useMemo(() => {
    const tiers: TiersEngage[] = data.map((l) => ({
      id: l.cle,
      nom: l.libelle ?? '—',
      code: l.code ?? '',
      filialeId: l.filiale_id ?? '',
      solde: l.valeur ?? 0,
      dateEffet: l.date_effet_solde,
    }));
    const range = classement(
      tiers.map((t) => ({ cle: t.id, libelle: t.nom, valeur: t.solde, detail: t.code || undefined })),
      limite,
      { replier: false },
    );
    return { tiers, lignes: range.lignes, maximum: range.maximum, total: range.total };
  }, [data, limite]);
}

/** Ceux qui nous doivent le plus. */
export const useTopCreancesClients = (filialeId: string | null, limite = 5) =>
  useTiersEngages(TOP_CREANCES_CLIENTS_QUERY, filialeId, limite);

/** Ceux à qui on doit le plus. */
export const useTopDettesFournisseurs = (filialeId: string | null, limite = 5) =>
  useTiersEngages(TOP_DETTES_FOURNISSEURS_QUERY, filialeId, limite);

export type TypeTiers = 'CLIENT' | 'FOURNISSEUR';

/**
 * L'activité d'un compte sur les douze derniers mois.
 *
 * `tiersId` nul : aucune ligne n'est lue. La requête est tout de même montée —
 * les hooks ne se conditionnent pas — mais sur un identifiant vide, qui ne
 * rapproche rien.
 */
export function useActiviteTiers(type: TypeTiers, tiersId: string | null, nombreMois = 12): {
  serie: SerieActiviteTiers;
  mois: string[];
} {
  const mois = useMemo(() => moisGlissants(new Date().toISOString(), nombreMois), [nombreMois]);
  const depuis = debutDesMois(mois);
  const { data } = useQuery<PointActiviteBrut>(
    type === 'CLIENT' ? ACTIVITE_CLIENT_QUERY : ACTIVITE_FOURNISSEUR_QUERY,
    [tiersId ?? '', depuis, tiersId ?? '', depuis],
  );
  const serie = useMemo(() => serieActiviteTiers(data, mois), [data, mois]);
  return { serie, mois };
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
  creances_clients: ClassementTiers;
  dettes_fournisseurs: ClassementTiers;
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
  // Les soldes ne dépendent pas de la fenêtre : un compte doit ce qu'il doit,
  // la période choisie ne change rien à sa dette.
  const creances_clients = useTopCreancesClients(filialeId);
  const dettes_fournisseurs = useTopDettesFournisseurs(filialeId);
  return {
    total, filiales, serie, repartition, lignesStock, anciennete, familles, clients, articles,
    creances_clients, dettes_fournisseurs, isLoading,
  };
}
