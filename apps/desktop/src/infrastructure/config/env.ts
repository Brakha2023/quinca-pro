import { z } from 'zod';

/**
 * Variables d'environnement validées au démarrage.
 * Une variable manquante ou mal formée fait échouer l'app immédiatement,
 * avec un message clair, plutôt qu'un comportement silencieux en prod.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(1),
  VITE_POWERSYNC_URL: z.string().url(),
});

const parsed = envSchema.safeParse(import.meta.env);

if (!parsed.success) {
  const details = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Configuration invalide (.env) :\n${details}`);
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
  powerSyncUrl: parsed.data.VITE_POWERSYNC_URL,
} as const;
