# Parte 2: Auth e papeis

Objetivo: substituir a sessao principal do frontend por Supabase Auth e preparar o onboarding de organizacao/papeis, sem alterar o design.

## Banco

### Migracao aplicada

- `supabase/migrations/0002_auth_bootstrap.sql`

### Funcoes adicionadas

- `public.slugify(text)`
- `public.bootstrap_current_user_organization(text, text)`

### Comportamento

- ao autenticar, o usuario passa a ter perfil sincronizado em `public.profiles`
- se o usuario ainda nao tiver membership ativo, o bootstrap cria:
  - uma organizacao
  - um membership com papel `owner`

## Frontend

### AuthContext

- `src/contexts/AuthContext.tsx` agora usa Supabase Auth
- o contexto expoe:
  - `user`
  - `session`
  - `role`
  - `organization`
  - `isAdmin`
  - `signIn`
  - `logout`
  - `signOut`
  - `refreshAuth`

### Cliente Supabase

- usa `src/lib/supabase/client.ts`
- mantem sessao persistente no browser

## Observacao historica

- durante a migracao inicial houve uma ponte temporaria de sessao legada para manter leituras no Firestore
- essa ponte foi removida na Parte 12, quando os modulos ativos deixaram de depender do Firebase

## Limitacoes temporarias na epoca

- o login principal ja era Supabase, mas partes do app ainda dependiam do backend legado
- a autorizacao real de negocio so ficaria completa quando as entidades fossem migradas para o Supabase

## Validacoes executadas

- `npm run lint`
- `npm run build`

## Proxima etapa

Parte 3: seguranca e RLS complementar

- endurecer policies por dominio
- preparar padrao de `organization_id` para entidades de negocio
- definir estrategia de auditoria e consentimento aplicada aos modulos reais
