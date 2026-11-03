import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  PORTEES, normaliserCodeRole, roleFormSchema,
  type Role, type RoleForm, type RoleFormInput, type UtilisateurAdministre,
} from '../../../core/parametres';
import Bouton from '../../components/ui/Bouton';
import { changerMotDePasse } from '../../../infrastructure/auth/motDePasse';
import { RolesRepository } from '../../../infrastructure/powersync/repositories/RolesRepository';
import Modal from '../../components/ui/Modal';
import FormField, { inputClass, inputErrorClass } from '../../components/ui/FormField';
import { useRepository } from '../../hooks/useRepository';
import { useNotifier } from '../../notifications/useNotifier';

const pied = (onClose: () => void, form: string, libelle: string, disabled: boolean) => (
  <>
    <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
    <button type="submit" form={form} disabled={disabled} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg">{libelle}</button>
  </>
);

/**
 * Créer ou renommer un rôle. Le code technique n'est pas saisi : il se déduit
 * du nom, et s'affiche pour qu'on sache ce qui partira au serveur.
 */
export function RoleFormModal({ role, onClose }: { role?: Role; onClose: () => void }) {
  const repository = useRepository(RolesRepository);
  const notifier = useNotifier();
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<RoleFormInput, unknown, RoleForm>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: role
      ? { nom: role.nom, description: role.description ?? '', profil: role.profil }
      : { nom: '', description: '', profil: 'CAISSIER' },
  });
  const nom = watch('nom') ?? '';
  const code = role?.est_systeme ? role.code : normaliserCodeRole(nom);

  const onSubmit = async (form: RoleForm) => {
    try {
      if (role) await repository.modifier(role.id, form, role.est_systeme);
      else await repository.creer(form);
      notifier('succes', `Rôle « ${form.nom} » ${role ? 'modifié' : 'créé'}.`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Enregistrement impossible.');
    }
  };

  return (
    <Modal
      titre={role ? `Modifier ${role.nom}` : 'Nouveau rôle'}
      sousTitre={role?.est_systeme ? 'Rôle livré avec l’application : le nom et la description se changent, le code et la portée non.' : undefined}
      largeur="max-w-lg"
      onClose={onClose}
      pied={pied(onClose, 'role-form', role ? 'Enregistrer' : 'Créer', isSubmitting)}
    >
      <form id="role-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          label="Nom du rôle"
          obligatoire
          erreur={errors.nom?.message}
          aide={code ? `Code technique : ${code}` : 'Ex. « Chef de rayon », « Contrôleur de gestion »'}
        >
          <input {...register('nom')} className={`${inputClass} ${errors.nom ? inputErrorClass : ''}`} data-testid="role-nom" autoFocus />
        </FormField>

        <FormField label="Description" erreur={errors.description?.message} aide="Ce que ce rôle fait dans la maison.">
          <input {...register('description')} className={inputClass} data-testid="role-description" />
        </FormField>

        <FormField
          label="Portée des données"
          obligatoire
          erreur={errors.profil?.message}
          aide={
            role?.est_systeme
              ? 'Figée pour un rôle livré avec l’application.'
              : 'Ce que les postes de ce rôle reçoivent. Un rôle « toutes les filiales » n’est rattaché à aucune : c’est la vue consolidée.'
          }
        >
          <select {...register('profil')} disabled={role?.est_systeme} className={`${inputClass} disabled:text-neutral-500`} data-testid="role-portee">
            {PORTEES.map((p) => (
              <option key={p.profil} value={p.profil}>{p.libelle} — {p.detail}</option>
            ))}
          </select>
        </FormField>
      </form>
    </Modal>
  );
}

/** Affecter un rôle à un compte, et la filiale que ce rôle exige. */
export function AffectationModal({
  utilisateur, roles, filiales, onClose,
}: {
  utilisateur: UtilisateurAdministre;
  roles: Role[];
  filiales: Array<{ id: string; nom: string }>;
  onClose: () => void;
}) {
  const repository = useRepository(RolesRepository);
  const notifier = useNotifier();
  const [roleId, setRoleId] = useState(utilisateur.role_id ?? '');
  const [filialeId, setFilialeId] = useState(utilisateur.filiale_id ?? '');
  const [enCours, setEnCours] = useState(false);

  const role = roles.find((r) => r.id === roleId) ?? null;
  const direction = role?.profil === 'DIRECTEUR';

  const enregistrer = async () => {
    if (!role) { notifier('erreur', 'Choisissez un rôle.'); return; }
    setEnCours(true);
    try {
      await repository.affecterRole(utilisateur.id, role.id, direction ? null : filialeId || null);
      notifier('succes', `${utilisateur.email} est désormais « ${role.nom} ».`);
      onClose();
    } catch (error) {
      notifier('erreur', error instanceof Error ? error.message : 'Affectation impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      titre={`Rôle de ${utilisateur.email}`}
      sousTitre="Le rôle décide de ce qu’il peut faire, et de ce que son poste reçoit."
      largeur="max-w-lg"
      onClose={onClose}
      pied={
        <>
          <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          <Bouton type="button" onClick={enregistrer} enCours={enCours} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" disabled={enCours} data-testid="affectation-enregistrer">Enregistrer</Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Rôle" obligatoire aide={role?.description ?? undefined}>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputClass} data-testid="affectation-role">
            <option value="">— Choisir un rôle —</option>
            {roles.filter((r) => r.est_actif || r.id === utilisateur.role_id).map((r) => (
              <option key={r.id} value={r.id}>{r.nom}{r.est_actif ? '' : ' (désactivé)'}</option>
            ))}
          </select>
        </FormField>

        <FormField
          label="Filiale de rattachement"
          obligatoire={!direction}
          aide={direction ? 'Ce rôle voit toutes les filiales : aucun rattachement.' : 'Le poste ne recevra que les données de cette filiale.'}
        >
          <select value={direction ? '' : filialeId} onChange={(e) => setFilialeId(e.target.value)} disabled={direction} className={`${inputClass} disabled:text-neutral-500`} data-testid="affectation-filiale">
            <option value="">{direction ? 'Toutes les filiales' : '— Choisir une filiale —'}</option>
            {filiales.map((f) => <option key={f.id} value={f.id}>{f.nom}</option>)}
          </select>
        </FormField>
      </div>
    </Modal>
  );
}

/**
 * Changement de mot de passe. Exigé à la première connexion du compte livré,
 * et disponible à tout moment pour soi-même.
 *
 * `obligatoire` retire la sortie : le compte superadministrateur arrive avec un
 * mot de passe écrit dans le README, il ne doit pas rester en place.
 */
export function MotDePasseModal({
  utilisateurId, obligatoire = false, onClose,
}: {
  utilisateurId: string;
  obligatoire?: boolean;
  onClose: () => void;
}) {
  const notifier = useNotifier();
  const [nouveau, setNouveau] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  const enregistrer = async () => {
    setErreur(null);
    if (nouveau !== confirmation) { setErreur('Les deux saisies ne sont pas identiques.'); return; }
    setEnCours(true);
    try {
      await changerMotDePasse(utilisateurId, nouveau);
      notifier('succes', 'Mot de passe changé.');
      onClose();
    } catch (error) {
      setErreur(error instanceof Error ? error.message : 'Changement impossible.');
    } finally {
      setEnCours(false);
    }
  };

  return (
    <Modal
      titre="Changer le mot de passe"
      sousTitre={obligatoire ? 'Ce compte utilise encore le mot de passe livré avec l’application : il faut en choisir un autre pour continuer.' : undefined}
      largeur="max-w-md"
      onClose={obligatoire ? () => undefined : onClose}
      pied={
        <>
          {!obligatoire && (
            <button type="button" onClick={onClose} className="px-4 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-medium rounded-lg">Annuler</button>
          )}
          <Bouton type="button" onClick={enregistrer} enCours={enCours} className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-neutral-300 text-white font-medium rounded-lg" disabled={enCours || !nouveau} data-testid="mot-de-passe-enregistrer">Enregistrer</Bouton>
        </>
      }
    >
      <div className="space-y-4">
        <FormField label="Nouveau mot de passe" obligatoire aide="Au moins 8 caractères, mêlant lettres et chiffres.">
          <input type="password" value={nouveau} onChange={(e) => setNouveau(e.target.value)} className={inputClass} data-testid="mot-de-passe-nouveau" autoFocus autoComplete="new-password" />
        </FormField>
        <FormField label="Confirmer" obligatoire erreur={erreur ?? undefined}>
          <input type="password" value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className={`${inputClass} ${erreur ? inputErrorClass : ''}`} data-testid="mot-de-passe-confirmation" autoComplete="new-password" />
        </FormField>
        <p className="text-xs text-neutral-500">
          Le serveur enregistre le nouveau mot de passe : il faut le réseau. L’empreinte de déverrouillage hors ligne du poste est renouvelée en même temps.
        </p>
      </div>
    </Modal>
  );
}
