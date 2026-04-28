import { sendJson } from '../_lib/auth.js';
import { withApiMiddleware } from '../_lib/middleware.js';
import { getSupabaseAdminClient } from '../_lib/supabaseAdmin.js';
import { isAuthorizedClientEmail, mapPublicClientStatus } from '../_lib/clientStatus.js';
import { getValidationErrorPayload, publicStatusRequestSchema, readValidatedJsonBody } from '../_lib/validation.js';

async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const { token, email } = await readValidatedJsonBody(request, publicStatusRequestSchema);

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

    const [
      { data: organization, error: organizationError },
      { data: proposals, error: proposalsError },
      { data: deals, error: dealsError },
      { data: projects, error: projectsError },
      { data: transactions, error: transactionsError },
      { data: documents, error: documentsError },
      { data: contracts, error: contractsError },
    ] =
      await Promise.all([
        supabase
          .from('organizations')
          .select('name, metadata, default_locale, default_currency, portal_enabled')
          .eq('id', client.organization_id)
          .maybeSingle(),
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
        supabase
          .from('projects')
          .select('id, name, status, progress, deadline, updated_at')
          .eq('organization_id', client.organization_id)
          .eq('client_id', client.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false }),
        supabase
          .from('transactions')
          .select('id, description, amount, status, due_date, payment_url')
          .eq('organization_id', client.organization_id)
          .eq('client_id', client.id)
          .eq('type', 'income')
          .is('deleted_at', null)
          .order('due_date', { ascending: false })
          .limit(20),
        supabase
          .from('documents')
          .select('id, display_name, signature_status, signature_url, updated_at')
          .eq('organization_id', client.organization_id)
          .eq('client_id', client.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(20),
        supabase
          .from('contracts')
          .select('id, title, status, amount, currency, starts_at, ends_at, auto_renew, next_renewal_at')
          .eq('organization_id', client.organization_id)
          .eq('client_id', client.id)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false }),
      ]);

    if (organizationError) throw organizationError;
    if (organization?.portal_enabled === false) {
      return sendJson(response, 404, {
        error: 'Este portal esta indisponivel no momento.',
      });
    }
    if (proposalsError) throw proposalsError;
    if (dealsError) throw dealsError;
    if (projectsError) throw projectsError;
    if (transactionsError) throw transactionsError;
    if (documentsError) throw documentsError;
    if (contractsError) throw contractsError;

    await supabase
      .from('clients')
      .update({ public_last_viewed_at: new Date().toISOString() })
      .eq('id', client.id);

    return sendJson(response, 200, {
      client: mapPublicClientStatus(
        client,
        organization,
        proposals ?? [],
        deals ?? [],
        projects ?? [],
        transactions ?? [],
        documents ?? [],
        contracts ?? [],
      ),
    });
  } catch (error) {
    console.error('Public client status error:', error);
    if (error?.statusCode === 400) {
      return sendJson(response, 400, getValidationErrorPayload(error, 'Informe o link e o email para consultar o pedido.'));
    }

    return sendJson(response, 500, {
      error: 'Nao foi possivel consultar o pedido agora.',
    });
  }
}

export default withApiMiddleware(handler, {
  rateLimit: { keyPrefix: 'public:client-status', limit: 30, windowMs: 60_000 },
});
