/**
 * Empreinte du mot de passe pour le déverrouillage hors ligne des postes.
 *
 * À chaque connexion réussie auprès de Supabase, l'application calcule une
 * empreinte PBKDF2 (sel aléatoire, 300 000 itérations, SHA-256) du mot de
 * passe et l'enregistre dans `utilisateurs.empreinte_hors_ligne`, synchronisée
 * vers tous les postes de la filiale. Hors ligne, le mot de passe saisi est
 * comparé à cette empreinte : le serveur reste la seule autorité, mais un
 * poste peut être déverrouillé par n'importe quel utilisateur de la filiale.
 * Le mot de passe en clair n'est jamais stocké ni transmis.
 *
 * Format : `pbkdf2$<itérations>$<sel base64>$<hash base64>`.
 */
const ITERATIONS = 300_000;

function versBase64(octets: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(octets)));
}

function depuisBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriver(motDePasse: string, sel: Uint8Array, iterations: number): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Cryptographie indisponible dans cette WebView');
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sel as BufferSource, iterations, hash: 'SHA-256' }, cle, 256);
  return versBase64(bits);
}

export async function calculerEmpreinte(motDePasse: string): Promise<string> {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${versBase64(sel)}$${await deriver(motDePasse, sel, ITERATIONS)}`;
}

/** Vrai si le mot de passe correspond à l'empreinte (faux pour une empreinte absente ou illisible). */
export async function verifierEmpreinte(empreinte: string | null | undefined, motDePasse: string): Promise<boolean> {
  if (!empreinte) return false;
  const [algo, iterations, sel, hash] = empreinte.split('$');
  if (algo !== 'pbkdf2' || !iterations || !sel || !hash) return false;
  try {
    return (await deriver(motDePasse, depuisBase64(sel), Number(iterations))) === hash;
  } catch {
    return false;
  }
}
