/**
 * Empreinte locale du mot de passe, pour déverrouiller le poste hors ligne.
 *
 * À chaque connexion réussie auprès de Supabase, on mémorise une empreinte
 * PBKDF2 (sel aléatoire, 100 000 itérations, SHA-256) du mot de passe. Hors
 * ligne, le mot de passe saisi est comparé à cette empreinte : le serveur
 * reste la seule autorité, mais le poste peut être déverrouillé sans lui.
 * Le mot de passe en clair n'est jamais stocké.
 */
const CLE_EMPREINTE = 'quinca.empreinte';
const ITERATIONS = 100_000;

interface Empreinte {
  email: string;
  sel: string;
  hash: string;
}

function versBase64(octets: ArrayBuffer | Uint8Array): string {
  return btoa(String.fromCharCode(...new Uint8Array(octets)));
}

function depuisBase64(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function deriver(motDePasse: string, sel: Uint8Array): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Cryptographie indisponible dans cette WebView');
  const cle = await crypto.subtle.importKey('raw', new TextEncoder().encode(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: sel as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' }, cle, 256);
  return versBase64(bits);
}

function lire(): Empreinte | null {
  try {
    const brut = localStorage.getItem(CLE_EMPREINTE);
    return brut ? (JSON.parse(brut) as Empreinte) : null;
  } catch {
    return null;
  }
}

export async function memoriserEmpreinte(email: string, motDePasse: string): Promise<void> {
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriver(motDePasse, sel);
  localStorage.setItem(CLE_EMPREINTE, JSON.stringify({ email: email.trim().toLowerCase(), sel: versBase64(sel), hash } satisfies Empreinte));
}

/** Vrai si une empreinte existe pour cet email et que le mot de passe correspond. */
export async function verifierEmpreinte(email: string, motDePasse: string): Promise<boolean> {
  const e = lire();
  if (!e || e.email !== email.trim().toLowerCase()) return false;
  return (await deriver(motDePasse, depuisBase64(e.sel))) === e.hash;
}

export function effacerEmpreinte(): void {
  localStorage.removeItem(CLE_EMPREINTE);
}
