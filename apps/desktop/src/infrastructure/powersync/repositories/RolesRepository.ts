import { motifNonSupprimable, normaliserCodeRole, type RoleForm } from '../../../core/parametres';
import { BaseRepository } from './BaseRepository';

/**
 * Rôles, permissions et affectations.
 *
 * Deux garde-fous existent **aussi** côté serveur (déclencheurs et RLS de la
 * migration 20260927000000) : ce qui est refusé ici est refusé là-bas, et
 * l'inverse n'est pas vrai. L'intérêt de le refuser ici est de le dire tout de
 * suite, et en français, au lieu de laisser l'écriture partir pour revenir
 * dans les écritures mises de côté.
 */

/** Rôles, avec le nombre de comptes qui les portent : c'est ce qui décide d'une suppression. */
export const ROLES_QUERY = `
  SELECT r.*, (SELECT COUNT(*) FROM utilisateurs u WHERE u.role_id = r.id) AS porteurs
  FROM roles r
  ORDER BY r.est_superadmin DESC, r.est_systeme DESC, r.nom`;

export const PERMISSIONS_ROLES_QUERY = 'SELECT id, role_id, permission FROM roles_permissions';

export const PERMISSIONS_UTILISATEUR_QUERY = `
  SELECT rp.permission
  FROM utilisateurs u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN roles_permissions rp ON rp.role_id = r.id
  WHERE u.id = ? AND u.est_actif != 0 AND r.est_actif != 0`;

export const ROLE_COURANT_QUERY = `
  SELECT r.* FROM utilisateurs u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`;

/**
 * Les comptes avec leur rôle et leur filiale. Un compte sans rôle apparaît
 * quand même : c'est précisément lui qu'il faut doter.
 */
export const UTILISATEURS_QUERY = `
  SELECT u.*, r.nom AS role_nom, r.est_superadmin AS role_est_superadmin, f.nom AS filiale_nom
  FROM utilisateurs u
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN filiales f ON f.id = u.filiale_id
  ORDER BY u.est_actif DESC, u.nom, u.prenom`;

export class RolesRepository extends BaseRepository {
  async creer(form: RoleForm): Promise<string> {
    const code = normaliserCodeRole(form.nom);
    if (!code) throw new Error('Le nom du rôle doit contenir au moins une lettre.');
    if (await this.codeExiste(code)) throw new Error(`Un rôle porte déjà ce nom (${code}).`);

    const id = this.nouvelId();
    const now = this.maintenant();
    await this.db.execute(
      `INSERT INTO roles (id, code, nom, description, profil, est_systeme, est_superadmin, est_actif, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, 1, ?, ?)`,
      [id, code, form.nom, form.description || null, form.profil, now, now],
    );
    return id;
  }

  /** Le code d'un rôle livré ne change pas : on ne renomme que ce qui s'affiche. */
  async modifier(id: string, form: RoleForm, estSysteme: boolean): Promise<void> {
    const valeurs: Record<string, string | null> = {
      nom: form.nom,
      description: form.description || null,
    };
    if (!estSysteme) {
      const code = normaliserCodeRole(form.nom);
      if (!code) throw new Error('Le nom du rôle doit contenir au moins une lettre.');
      if (await this.codeExiste(code, id)) throw new Error(`Un rôle porte déjà ce nom (${code}).`);
      valeurs.code = code;
      valeurs.profil = form.profil;
    }
    await this.patch(this.db, 'roles', id, valeurs);
  }

  async setActif(id: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'roles', id, { est_actif: actif ? 1 : 0 });
  }

  async supprimer(id: string): Promise<void> {
    const role = await this.db.get<{ nom: string; est_systeme: number; porteurs: number }>(
      `SELECT nom, est_systeme, (SELECT COUNT(*) FROM utilisateurs u WHERE u.role_id = r.id) AS porteurs
       FROM roles r WHERE id = ?`,
      [id],
    );
    const motif = motifNonSupprimable({ nom: role.nom, est_systeme: role.est_systeme === 1 }, role.porteurs);
    if (motif) throw new Error(motif);

    await this.db.writeTransaction(async (tx) => {
      // Les permissions partent avec le rôle : côté serveur c'est la cascade
      // qui s'en charge, mais la file d'envoi veut l'ordre explicite.
      await tx.execute('DELETE FROM roles_permissions WHERE role_id = ?', [id]);
      await tx.execute('DELETE FROM roles WHERE id = ?', [id]);
    });
  }

  /**
   * Fixe la liste exacte des permissions d'un rôle. Seule la différence est
   * écrite : cocher une case ne doit pas faire repartir les quarante autres
   * dans la file d'envoi.
   */
  async definirPermissions(roleId: string, permissions: string[]): Promise<void> {
    const voulues = new Set(permissions);
    await this.db.writeTransaction(async (tx) => {
      const actuelles = await tx.getAll<{ id: string; permission: string }>(
        'SELECT id, permission FROM roles_permissions WHERE role_id = ?',
        [roleId],
      );
      const deja = new Set(actuelles.map((p) => p.permission));

      for (const ligne of actuelles) {
        if (!voulues.has(ligne.permission)) {
          await tx.execute('DELETE FROM roles_permissions WHERE id = ?', [ligne.id]);
        }
      }
      const now = this.maintenant();
      for (const permission of voulues) {
        if (deja.has(permission)) continue;
        await tx.execute(
          'INSERT INTO roles_permissions (id, role_id, permission, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [this.nouvelId(), roleId, permission, now, now],
        );
      }
    });
  }

  /**
   * Affecte un rôle à un compte. La portée du rôle décide de la filiale : un
   * rôle de direction n'en a aucune, un rôle de filiale en exige une — c'est
   * la règle du serveur, appliquée ici pour l'annoncer avant l'envoi.
   */
  async affecterRole(utilisateurId: string, roleId: string, filialeId: string | null): Promise<void> {
    const role = await this.db.get<{ nom: string; profil: string; est_actif: number }>(
      'SELECT nom, profil, est_actif FROM roles WHERE id = ?',
      [roleId],
    );
    if (role.est_actif === 0) throw new Error(`Le rôle « ${role.nom} » est désactivé : il ne peut pas être affecté.`);

    const direction = role.profil === 'DIRECTEUR';
    if (!direction && !filialeId) {
      throw new Error(`Le rôle « ${role.nom} » travaille dans une filiale : choisissez-la.`);
    }
    await this.patch(this.db, 'utilisateurs', utilisateurId, {
      role_id: roleId,
      profil: role.profil,
      filiale_id: direction ? null : filialeId,
    });
  }

  async setActifUtilisateur(utilisateurId: string, actif: boolean): Promise<void> {
    await this.patch(this.db, 'utilisateurs', utilisateurId, { est_actif: actif ? 1 : 0 });
  }

  /** « Qu'il change son mot de passe à sa prochaine connexion. » */
  async exigerChangementMotDePasse(utilisateurId: string, exiger: boolean): Promise<void> {
    await this.patch(this.db, 'utilisateurs', utilisateurId, { doit_changer_mot_de_passe: exiger ? 1 : 0 });
  }

  async codeExiste(code: string, excludeId?: string): Promise<boolean> {
    const rows = await this.db.getAll<{ id: string }>('SELECT id FROM roles WHERE code = ? AND id != ? LIMIT 1', [
      code,
      excludeId ?? '',
    ]);
    return rows.length > 0;
  }
}
