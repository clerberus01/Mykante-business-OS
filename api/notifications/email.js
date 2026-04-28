import { Resend } from 'resend';
import { sendJson } from '../_lib/auth.js';
import { withApiMiddleware } from '../_lib/middleware.js';
import { readJsonBody } from '../_lib/request.js';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Mykante OS <onboarding@resend.dev>';

async function handler(request, response, authContext) {
  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' });
  }

  let dispatchContext = null;
  let adminClient = null;

  try {
    await readJsonBody(request);
    const { supabase, user, profile, organizationId } = authContext;
    adminClient = supabase;
    const userEmail = profile?.email || user.email;

    if (!userEmail) {
      return sendJson(response, 400, { error: 'Authenticated user does not have an email address.' });
    }

    dispatchContext = {
      organization_id: organizationId,
      user_id: user.id,
      channel: 'email',
      provider: 'resend',
      template_key: 'test_email',
      recipient: userEmail,
      payload: {
        test: true,
      },
    };

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
      ...dispatchContext,
      status: 'queued',
      external_message_id: data?.id ?? null,
    });

    return sendJson(response, 200, {
      success: true,
      accepted: true,
      id: data?.id ?? null,
      message:
        'O envio foi aceito pela Resend. Isso nao confirma entrega na caixa de entrada; confirme inbox, spam e o painel da Resend.',
    });
  } catch (error) {
    console.error('Email notification error:', error);

    if (dispatchContext && adminClient) {
      try {
        await adminClient.from('notification_dispatches').insert({
          ...dispatchContext,
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Failed to send email notification.',
        });
      } catch (dispatchError) {
        console.error('Email dispatch audit insert failed:', dispatchError);
      }
    }

    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Failed to send email notification.',
    });
  }
}

export default withApiMiddleware(handler, {
  auth: true,
  rateLimit: { keyPrefix: 'notifications:email', limit: 30, windowMs: 60_000 },
});
