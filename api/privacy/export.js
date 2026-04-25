import { getAuthenticatedContext, sendJson } from '../_lib/auth.js';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    const { supabase, user, organizationId } = await getAuthenticatedContext(request);

    const { data, error } = await supabase.rpc('export_current_user_personal_data');

    if (error) {
      throw error;
    }

    await supabase.from('data_subject_requests').insert({
      organization_id: organizationId,
      requester_user_id: user.id,
      subject_type: 'user',
      subject_id: user.id,
      request_type: 'access',
      status: 'completed',
      request_details: 'Exportacao eletronica imediata via area autenticada.',
      response_summary: 'Exportacao gerada no endpoint autenticado.',
      completed_at: new Date().toISOString(),
    });

    return sendJson(response, 200, {
      success: true,
      exportedAt: new Date().toISOString(),
      data,
    });
  } catch (error) {
    console.error('Privacy export error:', error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to export personal data.',
    });
  }
}
