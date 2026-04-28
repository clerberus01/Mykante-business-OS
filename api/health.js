import { getSupabaseAdminClient } from './_lib/supabaseAdmin.js';
import { sendJson } from './_lib/auth.js';
import { withApiMiddleware } from './_lib/middleware.js';

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

async function handler(request, response) {
  if (request.method !== 'GET') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const missingEnv = getMissingEnvKeys();
    if (missingEnv.length > 0) {
      return sendJson(response, 503, {
        success: false,
        checks: {
          database: 'skipped',
          env: 'missing',
        },
        missingEnvCount: missingEnv.length,
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
      checks: {
        database: 'ok',
        env: 'ok',
      },
      missingEnvCount: missingEnv.length,
      now: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Healthcheck failed:', error);
    return sendJson(response, 500, {
      success: false,
      error: 'Healthcheck failed.',
      missingEnvCount: getMissingEnvKeys().length,
      now: new Date().toISOString(),
    });
  }
}

export default withApiMiddleware(handler, {
  rateLimit: { keyPrefix: 'health', limit: 60, windowMs: 60_000 },
});
