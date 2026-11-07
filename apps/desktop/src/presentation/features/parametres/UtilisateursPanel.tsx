import { useMemo, useState } from 'react';
import {
  ArrowDownTrayIcon, KeyIcon, LockClosedIcon, LockOpenIcon, MagnifyingGlassIcon, PrinterIcon, UserCircleIcon,
} from '@heroicons/react/24/outline';
import Carte from '../../components/ui/Carte';
import {
  filtrerUtilisateurs, libellePortee, nomComplet, recapUtilisateurs,
  type EtatCompteRetenu, type UtilisateurAdministre,
} from '../../../core/parametres';
import Bouton from '../../components/ui/Bouton';
import { exporterExcel } from '../../../infrastructure/desktop/exporterExcel';
import { RolesRepository } from '../../../infrastructure/powersync/repositories/RolesRepository';
import { controleInlineClass, inputClass } from '../../components/ui/FormField';
import { useConfirmation } from '../../confirmation/useConfirmation';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';
import UtilisateursDocument from './UtilisateursDocument';
import { AffectationModal, MotDePasseModal } from './modales';
import { useRoles, useUtilisateursAdministres } from './hooks';

const ETATS: Array<{ id: EtatCompteRetenu; label: string }> = [
  { id: 'TOUS', label: 'Tous les comptes' },
  { id: 'ACTIFS', label: 'Actifs' },
  { id: 'DESACTIVES', label: 'Désactivés' },
  { id: 'SANS_ROLE', label: 'Sans rôle' },
];

interface Props {
  filiale: { nom: string; adresse?: string | null; telephone?: string | null };
  filiales: Array<{ id: string; nom: string }>;
  /** Compte de celui qui regarde : on ne se désactive pas soi-même. */
  utilisateurCourantId: string | null;
  peutModifier: boolean;
}

/**
 * Comptes et affectation des rôles.
 *
 * Un compte ne se crée pas ici : il naît d'un compte de connexion Supabase
 * (c'est lui qui porte le mot de passe). Ce qui s'administre ici, c'est ce que
 * le compte a le droit de faire — son rôle, sa filiale, son activité.
 */
export default function UtilisateursPanel({ filiale, filiales, utilisateurCourantId, peutModifier }: Props) {
  const repository = useRepository(RolesRepository);
  const notifier = useNotifier();
  const confirmer = useConfirmation();

  const { utilisateurs: tous } = useUtilisateursAdministres();
  const { roles } = useRoles();

  const [recherche, setRecherche] = useState('');
  const [etat, setEtat] = useState<EtatCompteRetenu>('TOUS');
  const [roleId, setRoleId] = useState('');
  const [modal, setModal] = useState<
    { type: 'affectation'; utilisateur: UtilisateurAdministre } | { type: 'mot-de-passe' } | { type: 'liste' } | null
  >(null);

  const filtres = useMemo(() => ({ recherche, etat, roleId: roleId || null }), [recherche, etat, roleId]);
  const utilisateurs = useMemo(() => filtrerUtilisateurs(tous, filtres), [tous, filtres]);
  const recap = recapUtilisateurs(utilisateurs);
  const nomRole = roles.find((r) => r.id === roleId)?.nom ?? null;

  const basculerActif = async (u: UtilisateurAdministre) => {
    if (u.id === utilisateurCourantId) { notifier('erreur', 'On ne désactive pas son propre compte.'); return; }
    const ok = await confirmer({
      titre: u.est_actif ? `Désactiver ${u.email}` : `Réactiver ${u.email}`,
      message: u.est_actif
        ? 'Le compte ne pourra plus ouvrir l’application, en ligne comme hors ligne. Son historique et ses pièces restent intacts.'
        : 'Le compte pourra de nouveau ouvrir l’application.',
      libelleConfirmer: u.est_actif ? 'Désactiver' : 'Réactiver',
      danger: u.est_actif,
    });
    if (!ok) return;
    try {
      await repository.setActifUtilisateur(u.id, !u.est_actif);
      notifier('succes', `Compte ${u.email} ${u.est_actif ? 'désactivé' : 'réactivé'}.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  const exigerChangement = async (u: UtilisateurAdministre) => {
    const ok = await confirmer({
      titre: `Exiger un nouveau mot de passe`,
      message: `${u.email} devra choisir un nouveau mot de passe à sa prochaine connexion. Le mot de passe actuel reste valable jusque-là : s'il doit être remplacé tout de suite, faites-le depuis le tableau de bord Supabase.`,
      libelleConfirmer: 'Exiger',
    });
    if (!ok) return;
    try {
      await repository.exigerChangementMotDePasse(u.id, true);
      notifier('succes', `${u.email} devra changer de mot de passe.`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Opération impossible.');
    }
  };

  const exporter = async () => {
    try {
      const chemin = await exporterExcel('utilisateurs', [{
        nom: 'Comptes',
        lignes: utilisateurs.map((u) => ({
          'E-mail': u.email,
          Nom: nomComplet(u),
          Rôle: u.role_nom ?? '—',
          'Portée des données': libellePortee(u.profil),
          Filiale: u.filiale_nom ?? (u.profil === 'DIRECTEUR' ? 'Toutes' : '—'),
          État: u.est_actif ? 'Actif' : 'Désactivé',
          'Mot de passe à changer': u.doit_changer_mot_de_passe ? 'Oui' : '',
        })),
      }]);
      if (chemin) notifier('succes', `Export enregistré : ${chemin}`);
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Export impossible.');
    }
  };

  const cellule = 'px-3 py-2 text-sm';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-neutral-600" data-testid="compteur-utilisateurs">
          <strong>{recap.nombre}</strong> compte(s) · {recap.actifs} actif(s)
          {recap.sans_role > 0 && <span className="ml-2 text-amber-700">· {recap.sans_role} sans rôle</span>}
          {recap.mot_de_passe_par_defaut > 0 && <span className="ml-2 text-amber-700">· {recap.mot_de_passe_par_defaut} mot(s) de passe à changer</span>}
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setModal({ type: 'mot-de-passe' })} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg" data-testid="changer-mon-mot-de-passe">
            <KeyIcon className="w-4 h-4" /> Mon mot de passe
          </button>
          <Bouton onClick={() => setModal({ type: 'liste' })} icone={PrinterIcon} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg" data-testid="imprimer-utilisateurs">Imprimer / PDF</Bouton>
          <Bouton onClick={exporter} icone={ArrowDownTrayIcon} className="flex items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 rounded-lg" data-testid="exporter-utilisateurs">Exporter Excel</Bouton>
        </div>
      </div>

      <p className="text-sm text-neutral-600 bg-neutral-50 border border-neutral-200 rounded-lg px-4 py-3">
        Un compte de connexion se crée dans le tableau de bord Supabase (<span className="font-mono text-xs">Authentication → Add user</span>),
        avec son nom et sa filiale dans les métadonnées. Il apparaît ici dès la synchronisation suivante, et c'est ici qu'on lui donne son rôle.
      </p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block text-xs font-medium text-neutral-700 mb-1">État</span>
          <select value={etat} onChange={(e) => setEtat(e.target.value as EtatCompteRetenu)} className={controleInlineClass} data-testid="utilisateurs-etat">
            {ETATS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Rôle</span>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={controleInlineClass} data-testid="utilisateurs-role">
            <option value="">Tous les rôles</option>
            {roles.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
          </select>
        </label>
        <label className="text-sm flex-1 min-w-[14rem] max-w-xs">
          <span className="block text-xs font-medium text-neutral-700 mb-1">Rechercher</span>
          <span className="relative block">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <input type="search" value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Nom, e-mail, rôle…" className={`${inputClass} pl-10`} data-testid="utilisateurs-recherche" />
          </span>
        </label>
      </div>

      <Carte titre="Comptes utilisateurs" icone={UserCircleIcon} sous={`${utilisateurs.length} compte(s)`} nu>
        <div className="overflow-x-auto">
        <table className="tableau divide-y divide-neutral-200">
          <thead className="bg-neutral-50">
            <tr className="text-left text-xs font-medium text-neutral-500 uppercase tracking-wider">
              <th className="px-3 py-2">Compte</th>
              <th className="px-3 py-2">Rôle</th>
              <th className="px-3 py-2">Portée des données</th>
              <th className="px-3 py-2">Filiale</th>
              <th className="px-3 py-2">État</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {utilisateurs.map((u) => (
              <tr key={u.id} className="hover:bg-neutral-50" data-testid={`compte-${u.email}`}>
                <td className={cellule}>
                  <span className="flex items-center gap-2 font-medium text-neutral-900">
                    <UserCircleIcon className="w-4 h-4 text-neutral-400" />
                    {nomComplet(u) || u.email}
                    {u.id === utilisateurCourantId && <span className="text-xs text-primary-700">(vous)</span>}
                  </span>
                  <span className="block text-xs text-neutral-500">{u.email}</span>
                  {u.doit_changer_mot_de_passe && (
                    <span className="block text-xs text-amber-700 mt-0.5">Mot de passe à changer à la prochaine connexion</span>
                  )}
                </td>
                <td className={cellule}>
                  {u.role_nom
                    ? <span className="text-neutral-800">{u.role_nom}{u.role_est_superadmin && ' ★'}</span>
                    : <span className="text-amber-700">Aucun rôle</span>}
                </td>
                <td className={`${cellule} text-neutral-600`}>{libellePortee(u.profil)}</td>
                <td className={`${cellule} text-neutral-600`}>{u.filiale_nom ?? (u.profil === 'DIRECTEUR' ? 'Toutes' : '—')}</td>
                <td className={cellule}>
                  {u.est_actif
                    ? <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Actif</span>
                    : <span className="px-2 py-0.5 text-xs rounded-full bg-neutral-100 text-neutral-600">Désactivé</span>}
                </td>
                <td className={`${cellule} text-right whitespace-nowrap`}>
                  {peutModifier && (
                    <span className="inline-flex gap-1">
                      <button type="button" onClick={() => setModal({ type: 'affectation', utilisateur: u })} className="px-2 py-1 text-xs text-primary-700 hover:bg-primary-50 rounded" data-testid={`affecter-${u.email}`}>
                        Rôle
                      </button>
                      {!u.doit_changer_mot_de_passe && (
                        <button type="button" onClick={() => exigerChangement(u)} title="Exiger un nouveau mot de passe" className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600">
                          <KeyIcon className="w-4 h-4" />
                        </button>
                      )}
                      {u.id !== utilisateurCourantId && (
                        <button type="button" onClick={() => basculerActif(u)} title={u.est_actif ? 'Désactiver le compte' : 'Réactiver le compte'} className="p-1.5 rounded hover:bg-neutral-200 text-neutral-600" data-testid={`basculer-${u.email}`}>
                          {u.est_actif ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                        </button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {utilisateurs.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-10 text-center text-sm text-neutral-400">Aucun compte ne correspond à ces filtres.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </Carte>

      {modal?.type === 'affectation' && (
        <AffectationModal
          utilisateur={modal.utilisateur}
          roles={roles}
          filiales={filiales}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'mot-de-passe' && utilisateurCourantId && (
        <MotDePasseModal utilisateurId={utilisateurCourantId} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'liste' && (
        <UtilisateursDocument
          utilisateurs={utilisateurs}
          filiale={filiale}
          filtres={filtres}
          nomRole={nomRole}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
