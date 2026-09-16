import { createClient } from '@supabase/supabase-js';
import { env } from '../config/env';

/**
 * Client Supabase unique de l'application.
 * Sert à l'authentification et à l'upload des écritures PowerSync ;
 * les lectures passent toujours par la base SQLite locale.
 */
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
