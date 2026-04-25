# Parte 9: Resend e OneSignal

## Objetivo

Preparar notificacoes transacionais seguras com Resend e OneSignal sem alterar o design do frontend.

## O que foi feito

- criada a tabela `public.notification_subscriptions`
- criada a tabela `public.notification_dispatches`
- mantida a tabela `public.notification_preferences` como fonte das preferencias por canal
- integrado o frontend com OneSignal Web SDK v16
- criado o service worker `OneSignalSDKWorker.js`
- adicionadas rotas server-side:
  - `api/notifications/email.js`
  - `api/notifications/push.js`
- conectada a tela `Settings` com:
  - toggle de e-mail
  - toggle de push web
  - toggle de WhatsApp
  - envio de teste por e-mail
  - envio de teste por push

## Comportamento de seguranca

- o `App ID` do OneSignal fica no frontend via `VITE_ONESIGNAL_APP_ID`
- as chaves privadas de Resend e OneSignal ficam apenas no backend
- os envios sao autenticados com o token da sessao Supabase
- cada envio registra trilha em `notification_dispatches`
- inscricoes push ficam vinculadas por organizacao e usuario em `notification_subscriptions`

## Resultado esperado

Depois desta fase, o sistema passa a:

- armazenar preferencias reais de notificacao
- sincronizar a inscricao web push do usuario autenticado
- enviar e-mail de teste via Resend
- enviar push de teste via OneSignal

sem alterar a estrutura visual principal do produto.
