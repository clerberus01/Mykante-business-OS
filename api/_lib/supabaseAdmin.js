import { createClient } from '@supabase/supabase-js';

function getRequiredEnv(name, fallback) {
  const value = process.env[name] || fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getSupabaseAdminClient() {
  const supabaseUrl = getRequiredEnv('SUPABASE_PROJECT_URL', process.env.VITE_SUPABASE_URL);
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
