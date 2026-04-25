const requiredEnv = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabasePublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
};

const optionalEnv = {
  oneSignalAppId: import.meta.env.VITE_ONESIGNAL_APP_ID,
};

function getRequiredEnvValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const env = {
  supabaseUrl: getRequiredEnvValue('VITE_SUPABASE_URL', requiredEnv.supabaseUrl),
  supabasePublishableKey: getRequiredEnvValue(
    'VITE_SUPABASE_PUBLISHABLE_KEY',
    requiredEnv.supabasePublishableKey,
  ),
  oneSignalAppId: optionalEnv.oneSignalAppId || null,
};
