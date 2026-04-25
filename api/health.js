import { getSupabaseAdminClient } from './_lib/supabaseAdmin.js';
import { sendJson } from './_lib/auth.js';
import { getPublicAppUrl } from './_lib/runtime.js';

const REQUIRED_SERVER_ENVS = [
  'SUPABASE_PROJECT_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'ONESIGNAL_APP_ID',
  'ONESIGNAL_API_KEY|ONESIGNAL_REST_API_KEY',
  'APP_URL',
];

function getMissingEnvKeys() {
  return REQUIRED_SERVER_ENVS.filter((key) => {
    if (key.includes('|')) {
      return !key.split('|').some((option) => process.env[option]);
    }

    return !process.env[key];
  });
}

export default async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const missingEnv = getMissingEnvKeys();
    const publicAppUrl = getPublicAppUrl();

    if (missingEnv.length > 0) {
      return sendJson(response, 503, {
        success: false,
        runtime: 'vercel-nodejs',
        checks: {
          database: 'skipped',
          env: 'missing',
          appUrl: publicAppUrl ? 'ok' : 'missing_or_invalid',
        },
        missingEnv,
        publicAppUrl,
        now: new Date().toISOString(),
      });
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from('organizations').select('id', { count: 'exact', head: true });

    if (error) {
      throw error;
    }

    return sendJson(response, 200, {
      success: true,
      runtime: 'vercel-nodejs',
      checks: {
        database: 'ok',
        env: 'ok',
        appUrl: publicAppUrl ? 'ok' : 'missing_or_invalid',
      },
      missingEnv,
      publicAppUrl,
      now: new Date().toISOString(),
    });
  } catch (error) {
    return sendJson(response, 500, {
      success: false,
      runtime: 'vercel-nodejs',
      error: error instanceof Error ? error.message : 'Healthcheck failed.',
      missingEnv: getMissingEnvKeys(),
      publicAppUrl: getPublicAppUrl(),
      now: new Date().toISOString(),
    });
  }
}
