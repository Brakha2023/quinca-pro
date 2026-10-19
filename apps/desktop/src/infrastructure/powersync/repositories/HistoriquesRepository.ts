import type { TypeMouvementStock } from '@quinca/shared-types';

/**
 * Lectures des historiques : aucune écriture, uniquement des requêtes.
 *
 * Les sections tirées du journal des mouvements (entrées, transferts,
 * déstockages, inventaires) regroupent les lignes par **référence** : une
 * pièce, une ligne de liste. Le regroupement se fait en SQL — un bon d'entrée
 * de deux cents articles ne doit pas remonter deux cents lignes pour en
 * afficher une.
 */

export interface FiltresPiecesStock {
  types: TypeMouvementStock[];
  debut?: string | null;
  fin?: string | null;
  depotId?: string | null;
  recherche?: string;
  limite?: number;
}

/** Bornes de journée : la fin est inclusive jusqu'à 23 h 59. */
const debutJour = (jour: string) => new Date(`${jour}T00:00:00`).toISOString();
const finJour = (jour: string) => new Date(`${jour}T23:59:59.999`).toISOString();

export function piecesStockQuery(filialeId: string | null, filtres: FiltresPiecesStock) {
  const types = filtres.types.length > 0 ? filtres.types : ['AJUSTEMENT'];
  const conditions = ['m.filiale_id = ?', `m.type IN (${types.map(() => '?').join(', ')})`];
  const params: Array<string | number> = [filialeId ?? '', ...types];

  if (filtres.debut) { conditions.push('m.created_at >= ?'); params.push(debutJour(filtres.debut)); }
  if (filtres.fin) { conditions.push('m.created_at <= ?'); params.push(finJour(filtres.fin)); }
  if (filtres.depotId) { conditions.push('m.depot_id = ?'); params.push(filtres.depotId); }
  const q = filtres.recherche?.trim();
  if (q) {
    conditions.push('(m.reference LIKE ? OR m.motif LIKE ? OR a.code LIKE ? OR a.designation LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
  }
  params.push(filtres.limite ?? 300);

  return {
    sql: `SELECT m.reference AS reference,
                 MIN(m.created_at) AS date,
                 COUNT(*) AS lignes,
                 SUM(ABS(m.quantite)) AS quantite,
                 -- Le coût est porté par le mouvement. Les bons passés avant
                 -- que les sorties soient valorisées n'en ont pas : on retombe
                 -- alors sur le coût moyen d'aujourd'hui, faute de mieux.
                 SUM(ABS(m.quantite) * COALESCE(m.cout_unitaire, s.cout_moyen, 0)) AS montant,
                 MAX(d.nom) AS depot_nom,
                 MAX(f.raison_sociale) AS fournisseur_nom,
                 MAX(m.motif) AS motif,
                 MAX(u.nom) AS utilisateur_nom, MAX(u.prenom) AS utilisateur_prenom
          FROM mouvements_stock m
          JOIN articles a ON a.id = m.article_id
          LEFT JOIN stocks s ON s.article_id = m.article_id AND s.depot_id = m.depot_id
          LEFT JOIN depots d ON d.id = m.depot_id
          LEFT JOIN fournisseurs f ON f.id = m.fournisseur_id
          LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
          WHERE ${conditions.join(' AND ')}
          GROUP BY m.reference
          ORDER BY date DESC
          LIMIT ?`,
    params,
  };
}

/** Ligne rendue par `piecesStockQuery`. */
export interface PieceStockRow {
  reference: string | null;
  date: string | null;
  lignes: number | null;
  quantite: number | null;
  montant: number | null;
  depot_nom: string | null;
  fournisseur_nom: string | null;
  motif: string | null;
  utilisateur_nom: string | null;
  utilisateur_prenom: string | null;
}
