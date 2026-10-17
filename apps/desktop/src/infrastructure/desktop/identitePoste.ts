import { codePosteValide, genererCodePoste, genererNumeroPiece } from '../../core/commun/numerotation';

/**
 * Identité de la machine, et non de la filiale ni de l'utilisateur : deux
 * caisses côte à côte doivent avoir deux codes, même sous le même compte.
 * D'où le stockage local plutôt que la base synchronisée.
 */
const CLE = 'quinca-code-poste';

/** Code retenu pour la session quand le stockage local est indisponible (fenêtre privée, WebView verrouillée). */
let secours: string | null = null;

function stockage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/**
 * Code de ce poste, stable d'un démarrage à l'autre : il préfixe toutes les
 * pièces créées ici, de sorte que deux postes hors ligne ne tirent jamais
 * dans le même espace de numéros.
 */
export function codePoste(): string {
  const magasin = stockage();
  const connu = codePosteValide(magasin?.getItem(CLE));
  if (connu) return connu;

  const code = secours ?? genererCodePoste();
  secours = code;
  try {
    magasin?.setItem(CLE, code);
  } catch {
    // Stockage en lecture seule : le code vaut pour cette session seulement.
  }
  return code;
}

/** Numéro d'une pièce créée sur ce poste (voir {@link genererNumeroPiece}). */
export function numeroPiece(prefixe: string, date?: Date): string {
  return genererNumeroPiece({ prefixe, poste: codePoste(), date });
}
