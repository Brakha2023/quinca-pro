import { calculerEmpreinte } from './empreinteLocale';
import { db } from '../powersync/database';
import { estErreurReseau, supabase } from '../supabase/client';

/**
 * Changement de mot de passe par l'utilisateur lui-même.
 *
 * Trois choses, dans cet ordre, et l'ordre compte :
 *   1. Supabase — c'est lui l'autorité ; s'il refuse, rien ne doit bouger.
 *   2. L'empreinte hors ligne, recalculée : sans elle, le poste continuerait
 *      d'accepter l'ancien mot de passe quand le réseau manque.
 *   3. Le drapeau `doit_changer_mot_de_passe`, qu'on baisse.
 *
 * Il faut le réseau : un mot de passe ne se change pas sur un poste isolé,
 * puisque le serveur doit l'enregistrer. Le message le dit.
 */

export const LONGUEUR_MINIMALE_MOT_DE_PASSE = 8;

export function verifierForce(motDePasse: string): string | null {
  if (motDePasse.length < LONGUEUR_MINIMALE_MOT_DE_PASSE) {
    return `Le mot de passe doit faire au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères.`;
  }
  if (!/[A-Za-z]/.test(motDePasse) || !/[0-9]/.test(motDePasse)) {
    return 'Le mot de passe doit mêler des lettres et des chiffres.';
  }
  return null;
}

export async function changerMotDePasse(utilisateurId: string, nouveau: string): Promise<void> {
  const faiblesse = verifierForce(nouveau);
  if (faiblesse) throw new Error(faiblesse);

  const { error } = await supabase.auth.updateUser({ password: nouveau });
  if (error) {
    if (estErreurReseau(error)) {
      throw new Error('Serveur injoignable : un mot de passe ne se change qu’en ligne. Réessayez dès que le réseau revient.');
    }
    throw new Error(error.message);
  }

  const empreinte = await calculerEmpreinte(nouveau);
  await db.execute('UPDATE utilisateurs SET empreinte_hors_ligne = ?, doit_changer_mot_de_passe = 0, updated_at = ? WHERE id = ?', [
    empreinte,
    new Date().toISOString(),
    utilisateurId,
  ]);
}
