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

### Ponte legada temporaria

- `src/lib/firebase.ts` agora tem uma sessao anonima temporaria para leitura do Firestore legado
- isso existe apenas para manter o app operacional enquanto CRM, projetos e financeiro ainda nao foram migrados

## Limitacoes temporarias

- os dados principais ainda estao no Firebase
- o login principal ja e Supabase, mas partes do app ainda dependem do backend legado
- a ponte legada foi mantida para reduzir quebra funcional durante a transicao
- a autorizacao real de negocio so ficara completa quando as entidades forem migradas para o Supabase

## Validacoes executadas

- `npm run lint`
- `npm run build`

## Proxima etapa

Parte 3: seguranca e RLS complementar

- endurecer policies por dominio
- preparar padrao de `organization_id` para entidades de negocio
- definir estrategia de auditoria e consentimento aplicada aos modulos reais
