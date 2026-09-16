import type { DepotForm } from '../../../core/articles';
import { BaseRepository } from './BaseRepository';

export const DEPOTS_QUERY = 'SELECT * FROM depots WHERE filiale_id = ? ORDER BY est_actif DESC, nom';
export const DEPOTS_ACTIFS_QUERY = 'SELECT * FROM depots WHERE filiale_id = ? AND est_actif = 1 ORDER BY nom';

export class DepotsRepository extends BaseRepository {
  async create(filialeId: string, form: DepotForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO depots (id, code, nom, adresse, responsable, filiale_id, est_actif, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, form.code, form.nom, form.adresse || null, form.responsable || null, filialeId, now, now],
    );
    return id;
  }

  async update(id: string, form: DepotForm): Promise<void> {
    await this.patch(this.db, 'depots', id, {
      code: form.code,
      nom: form.nom,
      adresse: form.adresse || null,
      responsable: form.responsable || null,
    });
  }

  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'depots', id, { est_actif: actif ? 1 : 0 });
  }

  async codeExiste(filialeId: string, code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>(
      'SELECT id FROM depots WHERE filiale_id = ? AND code = ? AND id != ? LIMIT 1',
      [filialeId, code, excludeId ?? ''],
    );
    return rows.length > 0;
  }
}
