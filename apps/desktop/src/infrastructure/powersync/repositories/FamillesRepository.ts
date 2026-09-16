import type { FamilleForm } from '../../../core/articles';
import { BaseRepository } from './BaseRepository';

export const FAMILLES_QUERY =
  'SELECT * FROM familles_articles WHERE filiale_id = ? ORDER BY est_active DESC, nom';
export const FAMILLES_ACTIVES_QUERY =
  'SELECT * FROM familles_articles WHERE filiale_id = ? AND est_active = 1 ORDER BY nom';

export class FamillesRepository extends BaseRepository {
  async create(filialeId: string, form: FamilleForm): Promise<string> {
    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO familles_articles (id, code, nom, description, filiale_id, est_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      [id, form.code, form.nom, form.description || null, filialeId, now, now],
    );
    return id;
  }

  async update(id: string, form: FamilleForm): Promise<void> {
    await this.patch(this.db, 'familles_articles', id, {
      code: form.code,
      nom: form.nom,
      description: form.description || null,
    });
  }

  async setActive(id: string, active: boolean): Promise<void> {
    await this.patch(this.db, 'familles_articles', id, { est_active: active ? 1 : 0 });
  }

  async codeExiste(filialeId: string, code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>(
      'SELECT id FROM familles_articles WHERE filiale_id = ? AND code = ? AND id != ? LIMIT 1',
      [filialeId, code, excludeId ?? ''],
    );
    return rows.length > 0;
  }
}
