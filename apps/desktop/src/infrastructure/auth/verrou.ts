/**
 * État « poste verrouillé » : la session Supabase et la base locale restent en
 * place (la synchronisation continue en arrière-plan), mais l'interface exige
 * le mot de passe. C'est ce que fait « Se déconnecter » en local-first : les
 * écritures en attente ne sont jamais perdues.
 */
const CLE_VERROU = 'quinca.verrou';

export function estVerrouille(): boolean {
  try {
    return localStorage.getItem(CLE_VERROU) === '1';
  } catch {
    return false;
  }
}

export function verrouiller(): void {
  localStorage.setItem(CLE_VERROU, '1');
}

export function deverrouiller(): void {
  localStorage.removeItem(CLE_VERROU);
}
