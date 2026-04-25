# Parte 11: Backend minimo na Vercel

## Objetivo

Preparar o projeto Vite + Supabase para deploy consistente na Vercel, mantendo o frontend atual e usando apenas um backend minimo em `api/` para operacoes sensiveis.

## O que foi configurado

- `vercel.json` com:
  - `framework: "vite"`
  - `buildCommand: "npm run build"`
  - `outputDirectory: "dist"`
  - runtime Node.js para `api/**/*.js`
  - `maxDuration` de 30 segundos
  - rewrite SPA para rotas nao `api`
- `api/health.js` para validar:
  - conectividade com Supabase
  - presenca das envs server-side essenciais
- `api/_lib/request.js` para parsing seguro de JSON body no runtime Node da Vercel
- service worker do OneSignal movido para `public/OneSignalSDKWorker.js`, garantindo publicacao no build do Vite

## Endpoints server-side ativos

- `POST /api/notifications/email`
- `POST /api/notifications/push`
- `POST /api/privacy/export`
- `POST /api/privacy/request`
- `GET /api/health`

## Variaveis esperadas na Vercel

### Cliente

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_ONESIGNAL_APP_ID`

### Servidor

- `APP_URL`
- `SUPABASE_PROJECT_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_API_KEY` ou `ONESIGNAL_REST_API_KEY`

### Operacao de time/projeto

- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_ID`

## Como validar apos deploy

1. Abrir `/api/health`
2. Confirmar `database: ok`
3. Confirmar `env: ok`
4. Abrir o app e testar:
   - push de teste
   - e-mail de teste
   - exportacao LGPD

## Referencias oficiais usadas

- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Vercel Functions: https://vercel.com/docs/functions
- `vercel.json`: https://vercel.com/docs/project-configuration/vercel-json
- Rewrites: https://vercel.com/docs/rewrites
