import { Resend } from 'resend';
import { getAuthenticatedContext, sendJson } from '../_lib/auth.js';
import { readJsonBody } from '../_lib/request.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Mykante OS <onboarding@resend.dev>';

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  try {
    await readJsonBody(request);
    const { supabase, user, profile, organizationId } = await getAuthenticatedContext(request);
    const userEmail = profile?.email || user.email;

    if (!userEmail) {
      return sendJson(response, 400, { error: 'Authenticated user does not have an email address.' });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [userEmail],
      subject: 'Teste de notificacao por e-mail',
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.5;">
          <h2>Teste de envio concluido</h2>
          <p>Este e-mail confirma que o canal transacional via Resend esta ativo.</p>
          <p>Usuario: ${profile?.full_name || userEmail}</p>
        </div>
      `,
      text: 'Este e-mail confirma que o canal transacional via Resend esta ativo.',
    });

    if (error) {
      throw error;
    }

    await supabase.from('notification_dispatches').insert({
      organization_id: organizationId,
      user_id: user.id,
      channel: 'email',
      provider: 'resend',
      template_key: 'test_email',
      recipient: userEmail,
      status: 'sent',
      external_message_id: data?.id ?? null,
      payload: {
        test: true,
      },
      sent_at: new Date().toISOString(),
    });

    return sendJson(response, 200, { success: true, id: data?.id ?? null });
  } catch (error) {
    console.error('Email notification error:', error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to send email notification.',
    });
  }
}
