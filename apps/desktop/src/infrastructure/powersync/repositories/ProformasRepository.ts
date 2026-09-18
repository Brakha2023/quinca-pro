import { genererNumeroPiece } from '../../../core/commun/numerotation';
import { calculerLigne, totauxProforma, type ProformaForm } from '../../../core/ventes';
import { BaseRepository } from './BaseRepository';

export interface FiltresProformas {
  clientId?: string | null;
  enCoursSeulement?: boolean;
  recherche?: string;
  limite?: number;
}

export function proformasQuery(filialeId: string | null, filtres: FiltresProformas = {}) {
  const conditions = ['p.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.clientId) { conditions.push('p.client_id = ?'); params.push(filtres.clientId); }
  if (filtres.enCoursSeulement) conditions.push("p.statut = 'EN_COURS'");
  const q = filtres.recherche?.trim();
  if (q) { conditions.push('(p.numero LIKE ? OR c.raison_sociale LIKE ? OR p.client_nom LIKE ?)'); params.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  params.push(filtres.limite ?? 300);
  return {
    sql: `SELECT p.*, COALESCE(c.raison_sociale, p.client_nom) AS client_libelle, v.numero AS vente_numero, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom,
                 (SELECT COUNT(*) FROM lignes_proforma l WHERE l.proforma_id = p.id) AS nombre_lignes
          FROM proformas p
          LEFT JOIN clients c ON c.id = p.client_id
          LEFT JOIN ventes v ON v.id = p.vente_id
          LEFT JOIN utilisateurs u ON u.id = p.utilisateur_id
          WHERE ${conditions.join(' AND ')}
          ORDER BY p.date_proforma DESC LIMIT ?`,
    params,
  };
}

export const LIGNES_PROFORMA_QUERY = 'SELECT * FROM lignes_proforma WHERE proforma_id = ? ORDER BY created_at';

export interface ContexteProforma {
  filialeId: string;
  utilisateurId: string | null;
}

/** Proformas : pièce + lignes, sans effet sur le stock ni la caisse. La facturation passe par le point de vente. */
export class ProformasRepository extends BaseRepository {
  enregistrer(ctx: ContexteProforma, form: ProformaForm): Promise<{ id: string; numero: string }> {
    return this.db.writeTransaction(async (tx) => {
      const id = this.nouvelId();
      const numero = form.numero || genererNumeroPiece('PRO');
      const now = this.maintenant();
      const t = totauxProforma(form);
      await tx.execute(
        `INSERT INTO proformas (id, numero, client_id, client_nom, date_proforma, date_validite, statut, remise_percent, total_ht, total_tva, total_ttc, vente_id, notes, utilisateur_id, filiale_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'EN_COURS', ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)`,
        [id, numero, form.client_id || null, form.client_nom || null, now, form.date_validite || null, form.remise_percent, t.total_net_ht, t.total_tva, t.total_ttc, form.notes || null, ctx.utilisateurId, ctx.filialeId, now, now],
      );
      for (const l of form.lignes) {
        const c = calculerLigne(l);
        await tx.execute(
          `INSERT INTO lignes_proforma (id, proforma_id, filiale_id, article_id, code_article, designation, unite, quantite, prix_unitaire_ttc, tva_percent, remise_percent, total_ttc, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [this.nouvelId(), id, ctx.filialeId, l.article_id, l.code, l.designation, l.unite, l.quantite, l.prix_unitaire_ttc, l.tva_percent, l.remise_percent, c.total_ttc, now],
        );
      }
      return { id, numero };
    });
  }

  async annuler(id: string): Promise<void> {
    await this.db.writeTransaction(async (tx) => {
      const p = await tx.get<{ statut: string }>('SELECT statut FROM proformas WHERE id = ?', [id]);
      if (p.statut !== 'EN_COURS') throw new Error('Seule une proforma en cours peut être annulée');
      await this.patch(tx, 'proformas', id, { statut: 'ANNULEE' });
    });
  }
}
