import { createClient } from '@supabase/supabase-js';

// Vite only auto-loads VITE_*; we also accept NEXT_PUBLIC_* so keys from Supabase docs / other templates work.
const url =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!url || !anonKey) {
  console.warn(
    '[TechTrack] Missing Supabase env vars. Use VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in .env.local (or NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY / ANON_KEY).'
  );
}

export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Add URL + anon/publishable key to .env.local (see .env.example).'
    );
  }
  return supabase;
}
