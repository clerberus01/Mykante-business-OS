import { sendJson } from '../_lib/auth.js';
import { readJsonBody } from '../_lib/request.js';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';
import { isAuthorizedClientEmail, mapPublicProposalStatus } from '../_lib/proposalStatus.js';

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
    const { data: proposal, error } = await supabase
      .from('proposals')
      .select(
        `
          id,
          title,
          value,
          status,
          description,
          valid_until,
          created_at,
          updated_at,
          public_status_enabled,
          clients (
            name,
            email,
            contact_email
          )
        `,
      )
      .eq('public_token', token)
      .eq('public_status_enabled', true)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const client = Array.isArray(proposal?.clients) ? proposal?.clients[0] : proposal?.clients;

    if (!proposal || !isAuthorizedClientEmail(email, client)) {
      return sendJson(response, 404, {
        error: 'Nao encontramos um pedido ativo para este link e email.',
      });
    }

    await supabase
      .from('proposals')
      .update({ public_last_viewed_at: new Date().toISOString() })
      .eq('id', proposal.id);

    return sendJson(response, 200, {
      proposal: mapPublicProposalStatus(proposal),
    });
  } catch (error) {
    console.error('Public proposal status error:', error);
    return sendJson(response, 500, {
      error: 'Nao foi possivel consultar o pedido agora.',
    });
  }
}
