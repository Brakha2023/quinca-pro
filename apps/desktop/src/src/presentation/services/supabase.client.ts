import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables d\'environnement Supabase manquantes. Vérifie le fichier .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Fonction de connexion
export async function login(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  return data;
}

// Fonction de déconnexion
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// Récupérer l'utilisateur courant
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Récupérer le token d'authentification
export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token;
}