import type { Transaction } from '@powersync/web';
import type { CaisseRow } from '@quinca/shared-types';
import { genererNumeroPiece } from '../../../core/commun/numerotation';
import type { CaisseForm, OperationForm, TransfertCaisseForm } from '../../../core/tresorerie';
import { BaseRepository } from './BaseRepository';

export const CAISSES_QUERY = 'SELECT * FROM caisses WHERE filiale_id = ? ORDER BY est_active DESC, nom';

export interface FiltresTresorerie {
  caisseId?: string | null;
  dateDebut?: string | null;
  dateFin?: string | null;
  type?: 'RECETTE' | 'DEPENSE' | null;
  limite?: number;
}

export function mouvementsTresorerieQuery(filialeId: string | null, filtres: FiltresTresorerie = {}) {
  const conditions = ['m.filiale_id = ?'];
  const params: Array<string | number> = [filialeId ?? ''];
  if (filtres.caisseId) { conditions.push('m.caisse_id = ?'); params.push(filtres.caisseId); }
  if (filtres.dateDebut) { conditions.push('m.date_operation >= ?'); params.push(new Date(`${filtres.dateDebut}T00:00:00`).toISOString()); }
  if (filtres.dateFin) { conditions.push('m.date_operation <= ?'); params.push(new Date(`${filtres.dateFin}T23:59:59.999`).toISOString()); }
  if (filtres.type) { conditions.push('m.type = ?'); params.push(filtres.type); }
  params.push(filtres.limite ?? 500);
  return {
    sql: `SELECT m.*, c.nom AS caisse_nom, u.nom AS utilisateur_nom, u.prenom AS utilisateur_prenom
          FROM mouvements_tresorerie m JOIN caisses c ON c.id = m.caisse_id LEFT JOIN utilisateurs u ON u.id = m.utilisateur_id
          WHERE ${conditions.join(' AND ')} ORDER BY m.date_operation DESC LIMIT ?`,
    params,
  };
}

export interface ContexteTresorerie {
  filialeId: string;
  utilisateurId: string | null;
}

export class TresorerieRepository extends BaseRepository {
  async createCaisse(filialeId: string, form: CaisseForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO caisses (id, code, nom, filiale_id, responsable, solde_actuel, est_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 1, ?, ?)`,
      [id, form.code, form.nom, filialeId, form.responsable || null, now, now],
    );
    return id;
  }

  async updateCaisse(id: string, form: CaisseForm): Promise<void> {
    await this.patch(this.db, 'caisses', id, { code: form.code, nom: form.nom, responsable: form.responsable || null });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.patch(this.db, 'caisses', id, { est_active: active ? 1 : 0 });
  }

  async codeExiste(filialeId: string, code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>('SELECT id FROM caisses WHERE filiale_id = ? AND code = ? AND id != ? LIMIT 1', [filialeId, code, excludeId ?? '']);
    return rows.length > 0;
  }

  /** Recette ou dépense manuelle : mouvement + solde de caisse. */
  enregistrerOperation(ctx: ContexteTresorerie, op: OperationForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = genererNumeroPiece(op.type === 'RECETTE' ? 'REC' : 'DEP');
      await this.mouvementer(tx, ctx, op.caisse_id, op.type, op.categorie, op.montant, op.description || null, op.reference || numero);
      return numero;
    });
  }

  /** Transfert entre deux caisses : une dépense et une recette portant la même référence. */
  transferer(ctx: ContexteTresorerie, t: TransfertCaisseForm): Promise<string> {
    return this.db.writeTransaction(async (tx) => {
      const numero = genererNumeroPiece('TRC');
      const source = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [t.caisse_source_id]);
      const dest = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [t.caisse_destination_id]);
      await this.mouvementer(tx, ctx, t.caisse_source_id, 'DEPENSE', 'TRANSFERT_CAISSE', t.montant, `Vers ${dest.nom ?? ''}${t.motif ? ` — ${t.motif}` : ''}`, numero);
      await this.mouvementer(tx, ctx, t.caisse_destination_id, 'RECETTE', 'TRANSFERT_CAISSE', t.montant, `Depuis ${source.nom ?? ''}${t.motif ? ` — ${t.motif}` : ''}`, numero);
      return numero;
    });
  }

  private async mouvementer(tx: Transaction, ctx: ContexteTresorerie, caisseId: string, type: 'RECETTE' | 'DEPENSE', categorie: string, montant: number, description: string | null, reference: string): Promise<void> {
    const now = this.maintenant();
    await tx.execute(
      `INSERT INTO mouvements_tresorerie (id, type, categorie, montant, description, reference, caisse_id, utilisateur_id, filiale_id, date_operation, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [this.nouvelId(), type, categorie, montant, description, reference, caisseId, ctx.utilisateurId, ctx.filialeId, now, now],
    );
    const caisse = await tx.get<CaisseRow>('SELECT * FROM caisses WHERE id = ?', [caisseId]);
    await this.patch(tx, 'caisses', caisseId, { solde_actuel: (caisse.solde_actuel ?? 0) + (type === 'RECETTE' ? montant : -montant) });
  }
}
