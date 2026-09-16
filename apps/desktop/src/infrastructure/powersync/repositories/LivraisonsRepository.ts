import type { LivraisonRow, StatutLivraison } from '@quinca/shared-types';
import { BaseRepository } from './BaseRepository';

export interface LivraisonVueRow extends LivraisonRow {
  client_nom: string | null;
  vente_numero: string | null;
  vente_total_ttc: number | null;
}

export function livraisonsQuery(filialeId: string | null, statut: StatutLivraison | null, recherche = '') {
  const conditions = ['l.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (statut) { conditions.push('l.statut = ?'); params.push(statut); }
  const q = recherche.trim();
  if (q) { conditions.push('(l.numero LIKE ? OR c.raison_sociale LIKE ? OR l.adresse_livraison LIKE ? OR l.chauffeur LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  return {
    sql: `SELECT l.*, c.raison_sociale AS client_nom, v.numero AS vente_numero, v.total_ttc AS vente_total_ttc
          FROM livraisons l LEFT JOIN clients c ON c.id = l.client_id LEFT JOIN ventes v ON v.id = l.vente_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY CASE l.statut WHEN 'A_PREPARER' THEN 0 WHEN 'EN_COURS' THEN 1 ELSE 2 END, l.date_livraison_prevue DESC LIMIT 500`,
    params,
  };
}

/** Transitions autorisées du cycle de vie d'une livraison. */
export const TRANSITIONS_LIVRAISON: Record<StatutLivraison, StatutLivraison[]> = {
  A_PREPARER: ['EN_COURS', 'ANNULEE'],
  EN_COURS: ['LIVREE', 'A_PREPARER', 'ANNULEE'],
  LIVREE: [],
  ANNULEE: ['A_PREPARER'],
};

export class LivraisonsRepository extends BaseRepository {
  async changerStatut(id: string, statut: StatutLivraison, details: { chauffeur?: string; vehicule?: string } = {}): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const l = await tx.get<LivraisonRow>('SELECT * FROM livraisons WHERE id = ?', [id]);
      const courant = (l.statut ?? 'A_PREPARER') as StatutLivraison;
      if (!TRANSITIONS_LIVRAISON[courant].includes(statut)) throw new Error(`Passage ${courant} → ${statut} non autorisé`);
      await this.patch(tx, 'livraisons', id, {
        statut,
        chauffeur: details.chauffeur ?? l.chauffeur,
        vehicule: details.vehicule ?? l.vehicule,
        date_livraison_reelle: statut === 'LIVREE' ? this.maintenant() : l.date_livraison_reelle,
      });
    });
  }

  async modifier(id: string, form: { adresse_livraison: string; date_livraison_prevue: string; chauffeur: string; vehicule: string }): Promise<void> {
    await this.patch(this.db, 'livraisons', id, {
      adresse_livraison: form.adresse_livraison,
      date_livraison_prevue: new Date(form.date_livraison_prevue).toISOString(),
      chauffeur: form.chauffeur || null,
      vehicule: form.vehicule || null,
    });
  }
}
