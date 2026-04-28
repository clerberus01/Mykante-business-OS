import { sendJson } from '../_lib/auth.js';
import { withApiMiddleware } from '../_lib/middleware.js';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';
import { isAuthorizedClientEmail, mapPublicProposalStatus } from '../_lib/proposalStatus.js';
import { getValidationErrorPayload, publicStatusRequestSchema, readValidatedJsonBody } from '../_lib/validation.js';

async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const { token, email } = await readValidatedJsonBody(request, publicStatusRequestSchema);

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
    if (error?.statusCode === 400) {
      return sendJson(response, 400, getValidationErrorPayload(error, 'Informe o link e o email para consultar o pedido.'));
    }

    return sendJson(response, 500, {
      error: 'Nao foi possivel consultar o pedido agora.',
    });
  }
}

export default withApiMiddleware(handler, {
  rateLimit: { keyPrefix: 'public:proposal-status', limit: 30, windowMs: 60_000 },
});
