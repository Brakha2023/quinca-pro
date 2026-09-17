/**
 * Utilisateur qui travaille sur le poste. Distinct de la session Supabase du
 * poste (celle du dernier utilisateur connecté en ligne, qui signe les envois) :
 * hors ligne, un collègue de la même filiale peut déverrouiller le poste et
 * travailler sous son propre nom — chaque écriture porte son `utilisateur_id`.
 */
const CLE_UTILISATEUR = 'quinca.utilisateur';

export function lireUtilisateurCourantId(): string | null {
  try {
    return localStorage.getItem(CLE_UTILISATEUR);
  } catch {
    return null;
  }
}

export function definirUtilisateurCourantId(id: string): void {
  localStorage.setItem(CLE_UTILISATEUR, id);
}

export function effacerUtilisateurCourantId(): void {
  localStorage.removeItem(CLE_UTILISATEUR);
}
