import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { CaisseRow, MouvementTresorerieRow, TransfertFilialeRow } from '@quinca/shared-types';
import {
  caisseFromRow, etatCaisses, recapEtatCaisses, soldeOuverture,
  type EnteteTransfertFonds, type MouvementCaisse, type MouvementJournal,
} from '../../../core/tresorerie';
import {
  CAISSES_QUERY, TRANSFERTS_FILIALES_QUERY, mouvementsDepuisQuery, mouvementsTresorerieQuery, type FiltresTresorerie,
} from '../../../infrastructure/powersync/repositories/TresorerieRepository';

export function useCaissesToutes(filialeId: string | null) {
  const { data } = useQuery<CaisseRow>(CAISSES_QUERY, [filialeId ?? '']);
  return useMemo(() => data.map(caisseFromRow), [data]);
}

export interface MouvementTresorerieVue extends MouvementTresorerieRow {
  caisse_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
}

export function useMouvementsTresorerie(filialeId: string | null, filtres: FiltresTresorerie = {}) {
  const { sql, params } = useMemo(
    () => mouvementsTresorerieQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.caisseId, filtres.dateDebut, filtres.dateFin, filtres.type, filtres.limite],
  );
  const { data, isLoading } = useQuery<MouvementTresorerieVue>(sql, params);
  return { mouvements: data, isLoading };
}

/**
 * Solde d'ouverture de la période : le solde actuel des caisses retenues,
 * duquel on retire tout ce qui a bougé depuis le début de la période.
 */
export function useSoldeOuverture(filialeId: string | null, caisseId: string | null, dateDebut: string) {
  const caisses = useCaissesToutes(filialeId);
  const { sql, params } = useMemo(() => mouvementsDepuisQuery(filialeId, caisseId, dateDebut), [filialeId, caisseId, dateDebut]);
  const { data } = useQuery<MouvementJournal & { id: string }>(sql, params);
  const soldeActuel = useMemo(
    () => caisses.filter((c) => !caisseId || c.id === caisseId).reduce((s, c) => s + c.solde_actuel, 0),
    [caisses, caisseId],
  );
  return { soldeActuel, ouverture: useMemo(() => soldeOuverture(soldeActuel, data), [soldeActuel, data]) };
}

/**
 * État de toutes les caisses sur une période : une seule lecture des
 * mouvements depuis le début de la période sert à la fois aux ouvertures et
 * aux totaux, caisse par caisse.
 */
export function useEtatCaisses(filialeId: string | null, dateDebut: string, dateFin: string) {
  const caisses = useCaissesToutes(filialeId);
  const { sql, params } = useMemo(() => mouvementsDepuisQuery(filialeId, null, dateDebut), [filialeId, dateDebut]);
  const { data, isLoading } = useQuery<MouvementCaisse & { id: string }>(sql, params);
  const finISO = useMemo(() => new Date(`${dateFin}T23:59:59.999`).toISOString(), [dateFin]);
  const lignes = useMemo(() => etatCaisses(caisses, data, finISO), [caisses, data, finISO]);
  return { caisses, lignes, recap: recapEtatCaisses(lignes), isLoading };
}

export interface TransfertFilialeVue extends TransfertFilialeRow {
  filiale_source_nom: string | null;
  filiale_destination_nom: string | null;
  caisse_source_nom: string | null;
  /** Les quatre suivants ne servent qu'au bordereau, et sont souvent nuls. */
  caisse_destination_nom: string | null;
  envoi_nom: string | null;
  envoi_prenom: string | null;
  reception_nom: string | null;
  reception_prenom: string | null;
}

const nomComplet = (prenom: string | null, nom: string | null) => [prenom, nom].filter(Boolean).join(' ') || null;

/** La ligne de la liste, telle que le bordereau la lit. */
export function enteteBordereau(t: TransfertFilialeVue): EnteteTransfertFonds {
  return {
    numero: t.numero,
    statut: t.statut,
    date_envoi: t.date_envoi,
    date_reception: t.date_reception,
    montant: t.montant,
    motif: t.motif,
    filiale_source_nom: t.filiale_source_nom,
    filiale_destination_nom: t.filiale_destination_nom,
    caisse_source_nom: t.caisse_source_nom,
    caisse_destination_nom: t.caisse_destination_nom,
    utilisateur_envoi: nomComplet(t.envoi_prenom, t.envoi_nom),
    utilisateur_reception: nomComplet(t.reception_prenom, t.reception_nom),
  };
}

export function useTransfertsFiliales(filialeId: string | null) {
  const { data, isLoading } = useQuery<TransfertFilialeVue>(TRANSFERTS_FILIALES_QUERY, [filialeId ?? '', filialeId ?? '']);
  return { transferts: data, isLoading };
}
