import { useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon, KeyIcon, LockClosedIcon, PencilSquareIcon, PlusIcon, PrinterIcon, ShieldCheckIcon, TrashIcon,
} from '@heroicons/react/24/outline';
import {
  CATALOGUE_PERMISSIONS, libellePortee, matricePermissions, motifNonSupprimable, permissionsModifiables,
  recapRoles, roleDesactivable,
} from '../../../core/parametres';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { RolesRepository } from '../../../infrastructure/powersync/repositories/RolesRepository';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import MatricePermissionsDocument from './MatricePermissionsDocument';
import { RoleFormModal } from './modales';
import { usePermissionsDesRoles, useRoles, type RoleAvecPorteurs } from './hooks';

interface Props {
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  /** Sans `parametres.roles`, l'écran se lit mais ne s'écrit pas. */
  peutModifier: boolean;
}

/**
 * Rôles et permissions.
 *
 * La liste des rôles en haut, le détail des permissions du rôle retenu en
 * dessous : c'est une matrice, et une matrice se lit mieux ligne à ligne que
 * dans quinze cases à cocher dispersées. Le tableau d'ensemble — tous les
 * rôles, toutes les permissions — s'imprime et s'exporte : c'est la pièce
 * qu'on fait signer.
 */
export default function RolesPanel({ filiale, peutModifier }: Props) {
  const repository = useRepository(RolesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();

  const { roles } = useRoles();
  const { parRole } = usePermissionsDesRoles();

  const [roleRetenuId, setRoleRetenuId] = useState<string | null>(null);
  const [modal, setModal] = useState<{ type: 'role'; role?: RoleAvecPorteurs } | { type: 'matrice' } | null>(null);
  /**
   * Cases cochées en cours d'édition. Le brouillon porte le rôle auquel il
   * appartient : changer de rôle l'abandonne, sans effet de bord — on ne coche
   * pas pour l'un et on n'enregistre pas pour l'autre.
   */
  const [edition, setEdition] = useState<{ roleId: string; permissions: Set<string> } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const roleRetenu = roles.find((r) => r.id === roleRetenuId) ?? null;
  const accordees = useMemo(() => parRole.get(roleRetenuId ?? '') ?? new Set<string>(), [parRole, roleRetenuId]);
  const recap = recapRoles(roles);

  const brouillon = edition && edition.roleId === roleRetenuId ? edition.permissions : null;

  const coche = (code: string) => (brouillon ?? accordees).has(code);
  const modifiable = Boolean(roleRetenu && peutModifier && permissionsModifiables(roleRetenu));

  const basculerPermission = (code: string) => {
    if (!modifiable) return;
    const jeu = new Set(brouillon ?? accordees);
    if (jeu.has(code)) jeu.delete(code); else jeu.add(code);
    setEdition({ roleId: roleRetenuId!, permissions: jeu });
  };

  const basculerModule = (codes: string[], tout: boolean) => {
    if (!modifiable) return;
    const jeu = new Set(brouillon ?? accordees);
    for (const code of codes) { if (tout) jeu.add(code); else jeu.delete(code); }
    setEdition({ roleId: roleRetenuId!, permissions: jeu });
  };

  const enregistrerPermissions = async () => {
    if (!roleRetenu || !brouillon) return;
    setEnCours(true);
    try {
      await repository.definirPermissions(roleRetenu.id, [...brouillon]);
      notifier('succes', `Permissions de « ${roleRetenu.nom} » enregistrées (${brouillon.size}).`);
      setEdition(null);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  const basculerActif = async (role: RoleAvecPorteurs) => {
    if (!roleDesactivable(role)) { notifier('erreur', 'Le rôle superadministrateur ne se désactive pas.'); return; }
    const ok = await confirmer({
      titre: role.est_actif ? `Désactiver « ${role.nom} »` : `Réactiver « ${role.nom} »`,
      message: role.est_actif
        ? `Le rôle ne sera plus proposé à l'affectation. Les ${role.porteurs} compte(s) qui le portent le gardent : donnez-leur un autre rôle si vous voulez leur retirer ces droits.`
        : 'Le rôle sera de nouveau proposé à l’affectation.',
      libelleConfirmer: role.est_actif ? 'Désactiver' : 'Réactiver',
      danger: role.est_actif,
    });
    if (!ok) return;
    try {
      await repository.setActif(role.id, !role.est_actif);
      notifier('succes', `Rôle « ${role.nom} » ${role.est_actif ? 'désactivé' : 'réactivé'}.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  const supprimer = async (role: RoleAvecPorteurs) => {
    const motif = motifNonSupprimable(role, role.porteurs);
    if (motif) { notifier('erreur', motif); return; }
    const ok = await confirmer({
      titre: `Supprimer « ${role.nom} »`,
      message: 'Le rôle et ses permissions seront effacés. Cette opération ne se défait pas.',
      libelleConfirmer: 'Supprimer',
      danger: true,
    });
    if (!ok) return;
    try {
      await repository.supprimer(role.id);
      if (roleRetenuId === role.id) setRoleRetenuId(null);
      notifier('succes', `Rôle « ${role.nom} » supprimé.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Suppression impossible.');
    }
  };

  const exporter = async () => {
    try {
      const lignes = matricePermissions(roles, parRole);
      const chemin = await exporterExcel('roles-et-permissions', [
        {
          nom: 'Rôles',
          lignes: roles.map((r) => ({
            Rôle: r.nom,
            Code: r.code,
            Portée: libellePortee(r.profil),
            Nature: r.est_superadmin ? 'Superadministrateur' : r.est_systeme ? 'Livré' : 'Sur mesure',
            Permissions: r.est_superadmin ? 'Toutes' : (parRole.get(r.id)?.size ?? 0),
            Comptes: r.porteurs,
            État: r.est_actif ? 'Actif' : 'Désactivé',
            Description: r.description ?? '',
          })),
        },
        {
          nom: 'Permissions',
          lignes: lignes.map((l) => ({
            Module: l.module,
            Permission: l.permission.libelle,
            Code: l.permission.code,
            ...Object.fromEntries(roles.map((r, i) => [r.nom, l.detenue[i] ? 'Oui' : ''])),
          })),
        },
      ]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const cellule = 'px-3 py-2 text-sm';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600" data-testid="compteur-roles">
          <strong>{recap.nombre}</strong> rôle(s) · {recap.actifs} actif(s) · {recap.sur_mesure} sur mesure
          {recap.sans_porteur > 0 && <span className="ml-2 text-neutral-500">· {recap.sans_porteur} sans porteur</span>}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setModal({ type: 'matrice' })} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg" data-testid="imprimer-roles">
            <PrinterIcon className="w-4 h-4" /> Imprimer / PDF
          </button>
          <button type="button" onClick={exporter} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg" data-testid="exporter-roles">
            <ArrowDownTrayIcon className="w-4 h-4" /> Exporter Excel
          </button>
          {peutModifier && (
            <button type="button" onClick={() => setModal({ type: 'role' })} className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg" data-testid="nouveau-role">
              <PlusIcon className="w-4 h-4" /> Nouveau rôle
            </button>
          )}
        </div>
      </div>

      {!peutModifier && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          Vous consultez les rôles sans pouvoir les modifier : définir qui a le droit de quoi demande la permission
          « Définir les rôles et leurs permissions ».
        </p>
      )}

      <div className="overflow-x-auto border border-neutral-200 rounded-xl">
        <table className="min-w-full divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Portée des données</th>
              <th className="px-3 py-2 text-right">Permissions</th>
              <th className="px-3 py-2 text-right">Comptes</th>
              <th className="px-3 py-2">État</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {roles.map((role) => {
              const retenu = role.id === roleRetenuId;
              return (
                <tr
                  key={role.id}
                  onClick={() => setRoleRetenuId(retenu ? null : role.id)}
                  className={`cursor-pointer ${retenu ? 'bg-primary-50' : 'hover:bg-neutral-50'}`}
                  data-testid={`role-${role.code}`}
                >
                  <td className={cellule}>
                    <span className="flex items-center gap-2 font-medium text-neutral-900">
                      {role.est_superadmin ? <ShieldCheckIcon className="w-4 h-4 text-primary-600" /> : role.est_systeme ? <LockClosedIcon className="w-4 h-4 text-neutral-400" /> : <KeyIcon className="w-4 h-4 text-neutral-400" />}
                      {role.nom}
                    </span>
                    <span className="block text-xs text-neutral-500 font-mono">{role.code}</span>
                    {role.description && <span className="block text-xs text-neutral-500 mt-0.5">{role.description}</span>}
                  </td>
                  <td className={`${cellule} text-neutral-700`}>{libellePortee(role.profil)}</td>
                  <td className={`${cellule} text-right font-mono`} data-testid={`permissions-${role.code}`}>
                    {role.est_superadmin ? 'toutes' : (parRole.get(role.id)?.size ?? 0)}
                  </td>
                  <td className={`${cellule} text-right font-mono`}>{role.porteurs}</td>
                  <td className={cellule}>
                    {role.est_actif
                      ? <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Actif</span>
                      : <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-600">Désactivé</span>}
                  </td>
                  <td className={`${cellule} text-right whitespace-nowrap`}>
                    {peutModifier && (
                      <span className="inline-flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setModal({ type: 'role', role })} title="Modifier" className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600" data-testid={`modifier-${role.code}`}>
                          <PencilSquareIcon className="w-4 h-4" />
                        </button>
                        {roleDesactivable(role) && (
                          <button type="button" onClick={() => basculerActif(role)} title={role.est_actif ? 'Désactiver' : 'Réactiver'} className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600">
                            <LockClosedIcon className="w-4 h-4" />
                          </button>
                        )}
                        {!role.est_systeme && (
                          <button type="button" onClick={() => supprimer(role)} title="Supprimer" className="p-1.5 rounded hover:bg-red-100 text-red-600" data-testid={`supprimer-${role.code}`}>
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!roleRetenu ? (
        <p className="text-sm text-neutral-500">Cliquez un rôle pour voir et ajuster ses permissions.</p>
      ) : (
        <div className="border border-neutral-200 rounded-xl overflow-hidden" data-testid="editeur-permissions">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-neutral-50 border-b border-neutral-200">
            <div>
              <p className="font-medium text-neutral-900">Permissions de « {roleRetenu.nom} »</p>
              <p className="text-xs text-neutral-500">
                {roleRetenu.est_superadmin
                  ? 'Le superadministrateur détient tout, par nature : il n’y a rien à cocher ni à décocher.'
                  : modifiable
                    ? `${(brouillon ?? accordees).size} permission(s) sur ${CATALOGUE_PERMISSIONS.reduce((n, m) => n + m.permissions.length, 0)}`
                    : 'Lecture seule.'}
              </p>
            </div>
            {brouillon && (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setEdition(null)} className="px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-200 rounded-lg">Annuler</button>
                <button type="button" onClick={enregistrerPermissions} disabled={enCours} className="px-4 py-2 text-sm bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" data-testid="enregistrer-permissions">
                  Enregistrer
                </button>
              </div>
            )}
          </div>

          <div className="grid gap-x-8 gap-y-5 p-4 md:grid-cols-2 xl:grid-cols-3">
            {CATALOGUE_PERMISSIONS.map((module) => {
              const codes = module.permissions.map((p) => p.code);
              const toutes = codes.every(coche);
              return (
                <div key={module.id}>
                  <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-neutral-200">
                    <p className="text-xs font-semibold text-neutral-700 uppercase tracking-wide">{module.libelle}</p>
                    {modifiable && (
                      <button type="button" onClick={() => basculerModule(codes, !toutes)} className="text-xs text-primary-700 hover:underline">
                        {toutes ? 'Tout décocher' : 'Tout cocher'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {module.permissions.map((permission) => (
                      <label key={permission.code} className={`flex items-start gap-2 text-sm ${modifiable ? 'cursor-pointer' : ''}`}>
                        <input
                          type="checkbox"
                          checked={roleRetenu.est_superadmin || coche(permission.code)}
                          disabled={!modifiable}
                          onChange={() => basculerPermission(permission.code)}
                          className="mt-0.5 rounded border-neutral-300 text-primary-600 focus:ring-primary-500 disabled:opacity-60"
                          data-testid={`permission-${permission.code}`}
                        />
                        <span>
                          <span className="text-neutral-800">{permission.libelle}</span>
                          {permission.detail && <span className="block text-xs text-neutral-500">{permission.detail}</span>}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {modal?.type === 'role' && <RoleFormModal role={modal.role} onClose={() => setModal(null)} />}
      {modal?.type === 'matrice' && (
        <MatricePermissionsDocument roles={roles} accordees={parRole} filiale={filiale} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
