import { sendJson } from '../_lib/auth.js';
import { readJsonBody } from '../_lib/request.js';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';
import { isAuthorizedClientEmail, mapPublicClientStatus } from '../_lib/clientStatus.js';

function isUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const body = await readJsonBody(request);
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';

    if (!isUuidLike(token) || !email) {
      return sendJson(response, 400, { error: 'Informe o link e o email para consultar o pedido.' });
    }

    const supabase = getSupabaseAdminClient();
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select(
        'id, organization_id, name, email, contact_email, status, created_at, updated_at, public_status_closed_at',
      )
      .eq('public_token', token)
      .eq('public_status_enabled', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (clientError) {
      throw clientError;
    }

    if (!client || !isAuthorizedClientEmail(email, client)) {
      return sendJson(response, 404, {
        error: 'Nao encontramos um pedido ativo para este link e email.',
      });
    }

    const [{ data: proposals, error: proposalsError }, { data: deals, error: dealsError }] =
      await Promise.all([
        supabase
          .from('proposals')
          .select('id, title, value, status, description, valid_until, updated_at')
          .eq('organization_id', client.organization_id)
          .eq('client_id', client.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('crm_deals')
          .select('id, title, value, probability, status, updated_at, crm_pipeline_stages(name)')
          .eq('organization_id', client.organization_id)
          .eq('client_id', client.id)
          .order('updated_at', { ascending: false }),
      ]);

    if (proposalsError) throw proposalsError;
    if (dealsError) throw dealsError;

    await supabase
      .from('clients')
      .update({ public_last_viewed_at: new Date().toISOString() })
      .eq('id', client.id);

    return sendJson(response, 200, {
      client: mapPublicClientStatus(client, proposals ?? [], deals ?? []),
    });
  } catch (error) {
    console.error('Public client status error:', error);
    return sendJson(response, 500, {
      error: 'Nao foi possivel consultar o pedido agora.',
    });
  }
}
