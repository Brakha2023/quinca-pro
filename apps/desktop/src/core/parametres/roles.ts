import { z } from 'zod';
import type { Profil, RoleRow } from '@quinca/shared-types';
import { CATALOGUE_PERMISSIONS, PERMISSIONS, peut, type DescriptionPermission } from './permissions';

/**
 * Rôles : ce qu'un utilisateur a le droit de faire.
 *
 * Deux notions cohabitent et il faut les garder distinctes.
 *
 *   * La **portée** (`profil`) décide de ce que le poste reçoit et de ce que le
 *     serveur laisse écrire : `DIRECTEUR` voit toutes les filiales, les autres
 *     la leur. Elle appartient au rôle, et un déclencheur serveur la recopie
 *     sur la fiche de l'utilisateur à chaque affectation.
 *   * Les **permissions** décident de ce qu'on peut faire dans ce périmètre.
 *     Elles se cochent une par une, sans migration.
 *
 * Un rôle de direction n'est rattaché à aucune filiale — c'est une règle du
 * serveur, pas un choix d'écran : l'affecter efface la filiale de la fiche.
 */

export interface Role {
  id: string;
  code: string;
  nom: string;
  description: string | null;
  profil: Profil;
  /** Livré avec l'application : son code, sa portée et sa nature sont figés. */
  est_systeme: boolean;
  /** Toutes les permissions, pour toujours. */
  est_superadmin: boolean;
  est_actif: boolean;
}

export function roleFromRow(row: RoleRow): Role {
  return {
    id: row.id,
    code: row.code ?? '',
    nom: row.nom ?? '',
    description: row.description,
    profil: (row.profil ?? 'CAISSIER') as Profil,
    est_systeme: row.est_systeme === 1,
    est_superadmin: row.est_superadmin === 1,
    est_actif: row.est_actif !== 0,
  };
}

/**
 * Code technique dérivé du nom : `Chef de rayon` → `role_chef_rayon`.
 * Le serveur l'exige préfixé `role_` et sans accent ni majuscule ; le gérant,
 * lui, ne tape qu'un nom.
 */
export function normaliserCodeRole(nom: string): string {
  const base = nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return base ? `role_${base}` : '';
}

export const roleFormSchema = z.object({
  nom: z.string().trim().min(2, 'Nom obligatoire').max(60),
  description: z.string().trim().max(200).optional().default(''),
  profil: z.enum(['DIRECTEUR', 'GERANT', 'CAISSIER', 'MAGASINIER']),
});
export type RoleForm = z.infer<typeof roleFormSchema>;
export type RoleFormInput = z.input<typeof roleFormSchema>;

/** Portées, dites comme on les dit à l'oral. */
export const PORTEES: Array<{ profil: Profil; libelle: string; detail: string }> = [
  { profil: 'DIRECTEUR', libelle: 'Toutes les filiales', detail: 'Vue consolidée, aucune filiale de rattachement.' },
  { profil: 'GERANT', libelle: 'Sa filiale — encadrement', detail: 'Toutes les données de sa filiale.' },
  { profil: 'CAISSIER', libelle: 'Sa filiale — comptoir', detail: 'Les données de sa filiale.' },
  { profil: 'MAGASINIER', libelle: 'Sa filiale — magasin', detail: 'Les données de sa filiale.' },
];

export const libellePortee = (profil: Profil): string =>
  PORTEES.find((p) => p.profil === profil)?.libelle ?? profil;

/** Un rôle de direction ne se rattache à aucune filiale. */
export const roleSansFiliale = (role: Pick<Role, 'profil'>): boolean => role.profil === 'DIRECTEUR';

/** Le nom, la description et les permissions se modifient toujours ; le reste, non. */
export const codeModifiable = (role: Pick<Role, 'est_systeme'>): boolean => !role.est_systeme;
export const porteeModifiable = (role: Pick<Role, 'est_systeme'>): boolean => !role.est_systeme;
export const permissionsModifiables = (role: Pick<Role, 'est_superadmin'>): boolean => !role.est_superadmin;
export const roleDesactivable = (role: Pick<Role, 'est_superadmin'>): boolean => !role.est_superadmin;

/**
 * Pourquoi ce rôle ne peut pas être supprimé — ou `null` s'il peut l'être.
 * Le message est celui qu'on montre : il dit quoi faire, pas seulement non.
 */
export function motifNonSupprimable(role: Pick<Role, 'nom' | 'est_systeme'>, porteurs: number): string | null {
  if (role.est_systeme) return `Le rôle « ${role.nom} » est livré avec l'application : il ne se supprime pas. Vous pouvez le désactiver.`;
  if (porteurs > 0) return `Le rôle « ${role.nom} » est encore affecté à ${porteurs} utilisateur(s) : donnez-leur un autre rôle d'abord.`;
  return null;
}

export interface RecapRoles {
  nombre: number;
  actifs: number;
  sur_mesure: number;
  sans_porteur: number;
}

export function recapRoles(roles: Array<Role & { porteurs: number }>): RecapRoles {
  return {
    nombre: roles.length,
    actifs: roles.filter((r) => r.est_actif).length,
    sur_mesure: roles.filter((r) => !r.est_systeme).length,
    sans_porteur: roles.filter((r) => r.porteurs === 0).length,
  };
}

/**
 * Les rôles livrés avec l'application, et ce qu'ils savent faire.
 *
 * Miroir du bloc de départ de `supabase/migrations/20260927000000_roles_permissions.sql` :
 * c'est le serveur qui les pose, ce module sert à les nommer, à les expliquer
 * à l'écran et à vérifier en test que les deux listes concordent. Toute
 * évolution se fait aux deux endroits — même convention que les énumérations
 * et leurs CHECK.
 */
export interface RoleSysteme {
  code: string;
  nom: string;
  profil: Profil;
  est_superadmin: boolean;
  /** `'*'` : toutes les permissions, par nature. */
  permissions: readonly string[] | '*';
}

const SANS_PARAMETRES = PERMISSIONS.filter((p) => !p.startsWith('parametres.'));

export const ROLES_SYSTEME: readonly RoleSysteme[] = [
  { code: 'role_superadmin', nom: 'Superadministrateur', profil: 'DIRECTEUR', est_superadmin: true, permissions: '*' },
  {
    code: 'role_directeur',
    nom: 'Directeur général',
    profil: 'DIRECTEUR',
    est_superadmin: false,
    // Tout, sauf la définition des rôles : décider qui a le droit de quoi
    // reste au compte qui administre l'application.
    permissions: PERMISSIONS.filter((p) => p !== 'parametres.roles'),
  },
  { code: 'role_gestionnaire', nom: 'Gérant de filiale', profil: 'GERANT', est_superadmin: false, permissions: SANS_PARAMETRES },
  {
    code: 'role_caissier',
    nom: 'Caissier',
    profil: 'CAISSIER',
    est_superadmin: false,
    permissions: [
      'pos.encaisser', 'ventes.lire', 'articles.lire', 'stock.lire',
      'clients.lire', 'clients.ecrire', 'clients.reglement', 'clients.proforma',
      'tresorerie.lire', 'tresorerie.mouvement', 'historiques.lire',
    ],
  },
  {
    code: 'role_magasinier',
    nom: 'Magasinier',
    profil: 'MAGASINIER',
    est_superadmin: false,
    permissions: [
      'articles.lire', 'articles.ecrire',
      'stock.lire', 'stock.entree', 'stock.sortie', 'stock.inventaire',
      'stock.transferer', 'stock.transferer_filiale', 'stock.production', 'stock.depots',
      'fournisseurs.lire', 'livraisons.lire', 'livraisons.ecrire', 'historiques.lire',
    ],
  },
];

/**
 * Tableau des rôles × permissions : une ligne par permission, une colonne par
 * rôle. C'est la feuille qu'on imprime pour la faire valider, et le même
 * tableau qui part en Excel — d'où ce calcul ici, et non dans l'écran.
 */
export interface LigneMatrice {
  module: string;
  permission: DescriptionPermission;
  /** Dans l'ordre des rôles reçus. */
  detenue: boolean[];
}

export function matricePermissions(
  roles: Array<Pick<Role, 'id' | 'est_superadmin'>>,
  accordees: Map<string, Set<string>>,
): LigneMatrice[] {
  return CATALOGUE_PERMISSIONS.flatMap((module) =>
    module.permissions.map((permission) => ({
      module: module.libelle,
      permission,
      detenue: roles.map((r) => peut(accordees.get(r.id) ?? [], permission.code, r.est_superadmin)),
    })),
  );
}
