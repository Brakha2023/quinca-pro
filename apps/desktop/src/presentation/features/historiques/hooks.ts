import { useMemo } from 'react';
import { useQuery } from '@powersync/react';
import {
  TYPES_MOUVEMENT_SECTION,
  type PieceHistorique,
  type SectionHistorique,
} from '../../../core/historiques';
import { piecesStockQuery, type PieceStockRow } from '../../../infrastructure/powersync/repositories/HistoriquesRepository';
import { commandesQuery } from '../../../infrastructure/powersync/repositories/FournisseursRepository';
import { productionsQuery } from '../../../infrastructure/powersync/repositories/ProductionsRepository';
import { ventesQuery, type VenteVueRow } from '../../../infrastructure/powersync/repositories/VentesRepository';
import type { CommandeVueRow } from '../fournisseurs/hooks';
import type { ProductionVueRow } from '../stock/ProductionPanel';

/** Filtres communs à toutes les sections. */
export interface FiltresSection {
  debut: string;
  fin: string;
  depotId?: string | null;
  recherche?: string;
}

const nomComplet = (prenom: string | null, nom: string | null) => [prenom, nom].filter(Boolean).join(' ') || null;

/**
 * Sections tirées du journal des mouvements : la pièce est la référence
 * commune à ses lignes, le regroupement se fait en SQL.
 */
export function usePiecesStock(filialeId: string | null, section: SectionHistorique, filtres: FiltresSection) {
  const types = TYPES_MOUVEMENT_SECTION[section] ?? [];
  const { sql, params } = useMemo(
    () => piecesStockQuery(filialeId, { types, debut: filtres.debut, fin: filtres.fin, depotId: filtres.depotId, recherche: filtres.recherche }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dépend des champs du filtre et de la section
    [filialeId, section, filtres.debut, filtres.fin, filtres.depotId, filtres.recherche],
  );
  const { data, isLoading } = useQuery<PieceStockRow>(sql, params);
  const pieces = useMemo<PieceHistorique[]>(
    () =>
      data.map((r) => ({
        id: r.reference ?? '',
        reference: r.reference ?? '',
        date: r.date ?? '',
        // L'entrée nomme son fournisseur ; les autres bons, leur motif.
        tiers: r.fournisseur_nom ?? r.motif ?? null,
        depot: r.depot_nom,
        lignes: r.lignes ?? 0,
        quantite: r.quantite ?? 0,
        montant: r.montant ?? 0,
        statut: null,
        utilisateur: nomComplet(r.utilisateur_prenom, r.utilisateur_nom),
      })),
    [data],
  );
  return { pieces, isLoading };
}

export function usePiecesVentes(filialeId: string | null, filtres: FiltresSection) {
  const { sql, params } = useMemo(
    () => ventesQuery(filialeId, { dateDebut: filtres.debut, dateFin: filtres.fin, recherche: filtres.recherche }),
    [filialeId, filtres.debut, filtres.fin, filtres.recherche],
  );
  const { data, isLoading } = useQuery<VenteVueRow>(sql, params);
  const pieces = useMemo<PieceHistorique[]>(
    () =>
      data.map((v) => ({
        id: v.id,
        reference: v.numero ?? '',
        date: v.date_vente ?? '',
        tiers: v.client_nom ?? 'Comptoir',
        depot: v.caisse_nom,
        lignes: v.nombre_lignes ?? 0,
        quantite: 0,
        montant: v.total_ttc ?? 0,
        statut: v.statut ?? null,
        utilisateur: nomComplet(v.utilisateur_prenom, v.utilisateur_nom),
      })),
    [data],
  );
  return { pieces, isLoading, brut: data };
}

export function usePiecesCommandes(filialeId: string | null, filtres: FiltresSection) {
  const { sql, params } = useMemo(
    () => commandesQuery(filialeId, { recherche: filtres.recherche }),
    [filialeId, filtres.recherche],
  );
  const { data, isLoading } = useQuery<CommandeVueRow>(sql, params);
  // `commandesQuery` ne borne pas la période : la section le fait ici, sur la
  // date de commande, plutôt que d'ajouter un filtre à l'écran des achats.
  const pieces = useMemo<PieceHistorique[]>(
    () =>
      data
        .filter((c) => dansPeriode(c.date_commande, filtres))
        .map((c) => ({
          id: c.id,
          reference: c.numero ?? '',
          date: c.date_commande ?? '',
          tiers: c.fournisseur_nom,
          depot: c.depot_nom,
          lignes: c.nombre_lignes ?? 0,
          quantite: 0,
          montant: c.total_ttc ?? 0,
          statut: c.statut ?? null,
          utilisateur: nomComplet(c.utilisateur_prenom, c.utilisateur_nom),
        })),
    [data, filtres],
  );
  return { pieces, isLoading, brut: data };
}

export function usePiecesProductions(filialeId: string | null, filtres: FiltresSection) {
  const { sql, params } = useMemo(
    () => productionsQuery(filialeId, { depotId: filtres.depotId, recherche: filtres.recherche, debut: filtres.debut, fin: filtres.fin }),
    [filialeId, filtres.debut, filtres.fin, filtres.depotId, filtres.recherche],
  );
  const { data, isLoading } = useQuery<ProductionVueRow>(sql, params);
  const pieces = useMemo<PieceHistorique[]>(
    () =>
      data.map((p) => ({
        id: p.id,
        reference: p.numero ?? '',
        date: p.date_debut ?? '',
        tiers: p.produits,
        depot: p.depot_nom,
        lignes: p.nombre_lignes ?? 0,
        quantite: p.quantite_produite ?? 0,
        montant: p.cout_matieres ?? 0,
        statut: null,
        utilisateur: nomComplet(p.utilisateur_prenom, p.utilisateur_nom),
      })),
    [data],
  );
  return { pieces, isLoading, brut: data };
}

/** Bornes de journée inclusives, sur une date ISO. */
function dansPeriode(date: string | null, filtres: FiltresSection): boolean {
  if (!date) return false;
  return date >= new Date(`${filtres.debut}T00:00:00`).toISOString() && date <= new Date(`${filtres.fin}T23:59:59.999`).toISOString();
}
