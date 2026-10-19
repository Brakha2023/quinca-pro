import { describe, expect, it } from 'vitest';
import {
  filtrerUtilisateurs, nomComplet, perimetreUtilisateurs, recapUtilisateurs,
  utilisateurAdministreFromRow, type UtilisateurAdministre,
} from './utilisateurs';

const compte = (p: Partial<UtilisateurAdministre> = {}): UtilisateurAdministre => ({
  id: 'u1', email: 'awa@cisse-freres.ci', nom: 'Koné', prenom: 'Awa', profil: 'CAISSIER',
  role_id: 'cai', filiale_id: 'f1', est_actif: true, doit_changer_mot_de_passe: false,
  role_nom: 'Caissier', role_est_superadmin: false, filiale_nom: 'Abidjan', ...p,
});

describe('utilisateurAdministreFromRow', () => {
  it('lit la fiche et le rôle joint à la lecture', () => {
    expect(utilisateurAdministreFromRow({
      id: 'u1', email: 'dg@cisse-freres.ci', nom: 'Cissé', prenom: null, profil: 'DIRECTEUR',
      role_id: 'dir', filiale_id: null, est_actif: 1, doit_changer_mot_de_passe: 1,
      empreinte_hors_ligne: null, created_at: null, updated_at: null,
      role_nom: 'Directeur général', role_est_superadmin: 0, filiale_nom: null,
    })).toMatchObject({ profil: 'DIRECTEUR', est_actif: true, doit_changer_mot_de_passe: true, role_nom: 'Directeur général' });
  });

  it('tient un compte pour actif tant qu’on ne l’a pas désactivé', () => {
    const u = utilisateurAdministreFromRow({
      id: 'u2', email: null, nom: null, prenom: null, profil: null, role_id: null, filiale_id: null,
      est_actif: null, doit_changer_mot_de_passe: null, empreinte_hors_ligne: null,
      created_at: null, updated_at: null,
    });
    expect(u.est_actif).toBe(true);
    expect(u.doit_changer_mot_de_passe).toBe(false);
    expect(u.role_nom).toBeNull();
  });
});

describe('nomComplet', () => {
  it('se passe du prénom quand il n’y en a pas', () => {
    expect(nomComplet({ nom: 'Koné', prenom: 'Awa' })).toBe('Awa Koné');
    expect(nomComplet({ nom: 'Cissé', prenom: null })).toBe('Cissé');
  });
});

describe('filtrerUtilisateurs', () => {
  const liste = [
    compte(),
    compte({ id: 'u2', email: 'ali@cisse-freres.ci', nom: 'Traoré', prenom: 'Ali', role_id: 'ger', role_nom: 'Gérant de filiale' }),
    compte({ id: 'u3', email: 'vieux@cisse-freres.ci', nom: 'Bakayoko', prenom: null, est_actif: false, role_id: null, role_nom: null }),
  ];

  it('ne retient par défaut aucun filtre', () => {
    expect(filtrerUtilisateurs(liste, {})).toHaveLength(3);
  });

  it('sépare les comptes actifs des comptes fermés', () => {
    expect(filtrerUtilisateurs(liste, { etat: 'ACTIFS' }).map((u) => u.id)).toEqual(['u1', 'u2']);
    expect(filtrerUtilisateurs(liste, { etat: 'DESACTIVES' }).map((u) => u.id)).toEqual(['u3']);
  });

  it('montre les comptes que personne n’a encore dotés d’un rôle', () => {
    expect(filtrerUtilisateurs(liste, { etat: 'SANS_ROLE' }).map((u) => u.id)).toEqual(['u3']);
  });

  it('cherche dans l’e-mail, le nom, le rôle et la filiale', () => {
    expect(filtrerUtilisateurs(liste, { recherche: 'traoré' }).map((u) => u.id)).toEqual(['u2']);
    expect(filtrerUtilisateurs(liste, { recherche: 'gérant' }).map((u) => u.id)).toEqual(['u2']);
    expect(filtrerUtilisateurs(liste, { recherche: 'abidjan' })).toHaveLength(3);
    expect(filtrerUtilisateurs(liste, { recherche: 'ALI@' }).map((u) => u.id)).toEqual(['u2']);
  });

  it('retient un seul rôle à la fois', () => {
    expect(filtrerUtilisateurs(liste, { roleId: 'cai' }).map((u) => u.id)).toEqual(['u1']);
  });

  it('cumule l’état et la recherche', () => {
    expect(filtrerUtilisateurs(liste, { etat: 'ACTIFS', recherche: 'bakayoko' })).toHaveLength(0);
  });
});

describe('recapUtilisateurs', () => {
  it('compte ce qui réclame une décision : sans rôle, mot de passe par défaut', () => {
    expect(recapUtilisateurs([
      compte(),
      compte({ id: 'u2', role_id: null, doit_changer_mot_de_passe: true }),
      compte({ id: 'u3', est_actif: false }),
    ])).toEqual({ nombre: 3, actifs: 2, sans_role: 1, mot_de_passe_par_defaut: 1 });
  });
});

describe('perimetreUtilisateurs', () => {
  it('écrit en clair ce que la feuille imprimée retient', () => {
    expect(perimetreUtilisateurs({ etat: 'ACTIFS' })).toBe('Comptes actifs');
    expect(perimetreUtilisateurs({ etat: 'TOUS', roleId: 'cai', recherche: 'Awa' }, 'Caissier'))
      .toBe('Tous les comptes · rôle « Caissier » · recherche « Awa »');
  });

  it('ne nomme pas un rôle qu’on ne lui a pas donné', () => {
    expect(perimetreUtilisateurs({ etat: 'TOUS', roleId: 'cai' })).toBe('Tous les comptes');
  });
});
