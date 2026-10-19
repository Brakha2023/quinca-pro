import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import type { CommandeFournisseurRow, FournisseurRow, LigneCommandeFournisseurRow, ReglementFournisseurRow } from '@quinca/shared-types';
import { commandeFromRow, fournisseurFromRow, ligneCommandeFromRow, reglementFournisseurFromRow } from '../../../core/fournisseurs';
import {
  ACHATS_FOURNISSEUR_QUERY, COMMANDE_QUERY, LIGNES_COMMANDE_QUERY, REGLEMENTS_FOURNISSEUR_QUERY, commandesQuery, fournisseursQuery, reglementsFournisseursQuery,
  type FiltresCommandes, type FiltresFournisseurs, type FiltresReglementsFournisseurs,
} from '../../../infrastructure/powersync/repositories/FournisseursRepository';

export function useFournisseurs(filialeId: string | null, filtres: FiltresFournisseurs = {}) {
  const { sql, params } = useMemo(
    () => fournisseursQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.recherche, filtres.inclureInactifs, filtres.avecDette],
  );
  const { data, isLoading } = useQuery<FournisseurRow>(sql, params);
  const fournisseurs = useMemo(() => data.map(fournisseurFromRow), [data]);
  return { fournisseurs, isLoading };
}

export function useFournisseur(id: string | null) {
  const { data } = useQuery<FournisseurRow>('SELECT * FROM fournisseurs WHERE id = ?', [id ?? '']);
  return data[0] ? fournisseurFromRow(data[0]) : null;
}

export function useAchatsFournisseur(id: string | null) {
  const { data } = useQuery<CommandeFournisseurRow>(ACHATS_FOURNISSEUR_QUERY, [id ?? '']);
  return useMemo(() => data.map(commandeFromRow), [data]);
}

export function useReglementsFournisseur(id: string | null) {
  const { data } = useQuery<ReglementFournisseurRow & { caisse_nom: string | null }>(REGLEMENTS_FOURNISSEUR_QUERY, [id ?? '']);
  return useMemo(() => data.map((r) => ({ ...reglementFournisseurFromRow(r), caisse_nom: r.caisse_nom })), [data]);
}

export interface CommandeVueRow extends CommandeFournisseurRow {
  fournisseur_nom: string | null;
  depot_nom: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
  nombre_lignes: number;
}

export function useCommandes(filialeId: string | null, filtres: FiltresCommandes = {}) {
  const { sql, params } = useMemo(
    () => commandesQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.fournisseurId, filtres.ouvertesSeulement, filtres.recherche, filtres.limite],
  );
  const { data, isLoading } = useQuery<CommandeVueRow>(sql, params);
  return { commandes: data, isLoading };
}

/** Une pièce fournisseur, noms joints : la facture s'édite depuis elle. */
export function useCommande(id: string | null) {
  const { data } = useQuery<CommandeVueRow>(COMMANDE_QUERY, [id ?? '']);
  return data[0] ?? null;
}

export function useLignesCommande(commandeId: string | null) {
  const { data } = useQuery<LigneCommandeFournisseurRow>(LIGNES_COMMANDE_QUERY, [commandeId ?? '']);
  return useMemo(() => data.map(ligneCommandeFromRow), [data]);
}

export interface ReglementFournisseurVueRow extends ReglementFournisseurRow {
  fournisseur_nom: string | null;
  fournisseur_code: string | null;
  caisse_nom: string | null;
  commande_numero: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
}

export function useReglementsFournisseurs(filialeId: string | null, filtres: FiltresReglementsFournisseurs = {}) {
  const { sql, params } = useMemo(
    () => reglementsFournisseursQuery(filialeId, filtres),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre
    [filialeId, filtres.fournisseurId, filtres.dateDebut, filtres.dateFin, filtres.limite],
  );
  const { data, isLoading } = useQuery<ReglementFournisseurVueRow>(sql, params);
  return { reglements: data, isLoading };
}
