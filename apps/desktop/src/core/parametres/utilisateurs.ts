import type { Profil, UtilisateurRow } from '@quinca/shared-types';

/**
 * Les comptes, vus depuis les paramètres : qui travaille, avec quel rôle, dans
 * quelle filiale.
 *
 * Un compte ne se crée pas ici : il naît d'un compte de connexion (Supabase
 * Auth), et l'application lui donne son rôle. Ce module décrit donc ce qu'on
 * administre vraiment — le rôle, la filiale, l'activité du compte.
 */

export interface UtilisateurAdministre {
  id: string;
  email: string;
  nom: string;
  prenom: string | null;
  profil: Profil;
  role_id: string | null;
  filiale_id: string | null;
  est_actif: boolean;
  /** Mot de passe par défaut encore en place. */
  doit_changer_mot_de_passe: boolean;
  /** Nom du rôle, joint à la lecture (jamais recalculé ici). */
  role_nom: string | null;
  role_est_superadmin: boolean;
  filiale_nom: string | null;
}

export function utilisateurAdministreFromRow(
  row: UtilisateurRow & { role_nom?: string | null; role_est_superadmin?: number | null; filiale_nom?: string | null },
): UtilisateurAdministre {
  return {
    id: row.id,
    email: row.email ?? '',
    nom: row.nom ?? '',
    prenom: row.prenom,
    profil: (row.profil ?? 'CAISSIER') as Profil,
    role_id: row.role_id,
    filiale_id: row.filiale_id,
    est_actif: row.est_actif !== 0,
    doit_changer_mot_de_passe: row.doit_changer_mot_de_passe === 1,
    role_nom: row.role_nom ?? null,
    role_est_superadmin: row.role_est_superadmin === 1,
    filiale_nom: row.filiale_nom ?? null,
  };
}

export const nomComplet = (u: Pick<UtilisateurAdministre, 'nom' | 'prenom'>): string =>
  `${u.prenom ?? ''} ${u.nom}`.trim();

export type EtatCompteRetenu = 'TOUS' | 'ACTIFS' | 'DESACTIVES' | 'SANS_ROLE';

export interface FiltresUtilisateurs {
  recherche?: string;
  etat?: EtatCompteRetenu;
  roleId?: string | null;
}

export function filtrerUtilisateurs(liste: UtilisateurAdministre[], filtres: FiltresUtilisateurs): UtilisateurAdministre[] {
  const terme = (filtres.recherche ?? '').trim().toLowerCase();
  const etat = filtres.etat ?? 'TOUS';
  return liste.filter((u) => {
    if (etat === 'ACTIFS' && !u.est_actif) return false;
    if (etat === 'DESACTIVES' && u.est_actif) return false;
    if (etat === 'SANS_ROLE' && u.role_id) return false;
    if (filtres.roleId && u.role_id !== filtres.roleId) return false;
    if (!terme) return true;
    return [u.email, nomComplet(u), u.role_nom ?? '', u.filiale_nom ?? '']
      .some((champ) => champ.toLowerCase().includes(terme));
  });
}

export interface RecapUtilisateurs {
  nombre: number;
  actifs: number;
  sans_role: number;
  mot_de_passe_par_defaut: number;
}

export function recapUtilisateurs(liste: UtilisateurAdministre[]): RecapUtilisateurs {
  return {
    nombre: liste.length,
    actifs: liste.filter((u) => u.est_actif).length,
    sans_role: liste.filter((u) => !u.role_id).length,
    mot_de_passe_par_defaut: liste.filter((u) => u.doit_changer_mot_de_passe).length,
  };
}

/** Périmètre retenu, écrit en clair en tête du document imprimé. */
export function perimetreUtilisateurs(filtres: FiltresUtilisateurs, nomRole?: string | null): string {
  const morceaux: string[] = [];
  const etats: Record<EtatCompteRetenu, string> = {
    TOUS: 'Tous les comptes',
    ACTIFS: 'Comptes actifs',
    DESACTIVES: 'Comptes désactivés',
    SANS_ROLE: 'Comptes sans rôle',
  };
  morceaux.push(etats[filtres.etat ?? 'TOUS']);
  if (filtres.roleId && nomRole) morceaux.push(`rôle « ${nomRole} »`);
  if (filtres.recherche?.trim()) morceaux.push(`recherche « ${filtres.recherche.trim()} »`);
  return morceaux.join(' · ');
}
