# Etapa C - Ajustes de producao

## Objetivo

Endurecer a configuracao de runtime para deploy real na Vercel sem alterar o design da aplicacao.

## Ajustes aplicados

- criado helper server-side de URL publica em `api/_lib/runtime.js`
- `api/health.js` agora valida `APP_URL`, expone `publicAppUrl` e retorna `503` quando envs obrigatorias estiverem ausentes
- `api/notifications/push.js` agora usa URL publica resolvida, registra dispatch como `queued` quando a OneSignal aceita o envio e `failed` quando a chamada falha
- `src/lib/onesignal.ts` passou a usar `serviceWorkerPath` absoluto e restringe `allowLocalhostAsSecureOrigin` ao ambiente local
- `.env.example` foi atualizado para refletir `APP_URL` de producao e remetente proprio no Resend

## Resultado esperado

- healthcheck mais confiavel para diagnostico em deploy
- links enviados pelo backend usando origem publica consistente
- menos falso positivo em dispatch de notificacoes
- configuracao do OneSignal alinhada ao comportamento esperado em producao
