# Parte 1: Base do Supabase

Objetivo: criar a estrutura inicial do banco no Supabase para suportar autenticacao, multiorganizacao, trilha de auditoria, consentimento e preferencias de notificacao.

## Migracao aplicada

- arquivo: `supabase/migrations/0001_base_structure.sql`
- status: aplicada no projeto Supabase

## Objetos criados

### Tipos

- `public.app_role`
- `public.notification_channel`
- `public.consent_status`

### Tabelas

- `public.organizations`
- `public.profiles`
- `public.organization_members`
- `public.audit_logs`
- `public.consents`
- `public.notification_preferences`

### Funcoes

- `public.set_updated_at()`
- `public.handle_new_user()`
- `public.is_org_member(uuid)`
- `public.has_org_role(uuid, text[])`

### Triggers

- atualizacao automatica de `updated_at`
- sincronizacao de `auth.users` -> `public.profiles`

### RLS inicial

- `profiles`: leitura e atualizacao do proprio usuario
- `organizations`: leitura por membro, insert autenticado, update por owner/admin
- `organization_members`: leitura por membro, gestao por owner/admin
- `audit_logs`: leitura por owner/admin/manager, insert por membro autenticado
- `consents`: leitura e gestao por owner/admin/manager
- `notification_preferences`: gestao do proprio usuario ou owner/admin

## Validacoes executadas

- tabelas publicas verificadas
- policies RLS verificadas
- triggers principais verificados

## Observacoes importantes

- ainda nao existe fluxo de onboarding para criar organizacao e vincular automaticamente o usuario como `owner`
- a base estrutural foi criada antes das tabelas de negocio
- nenhuma tela teve design alterado

## Proxima etapa

Parte 2: autenticacao e perfis

- cliente Supabase no frontend
- substituicao do `AuthContext`
- sessao real com Supabase Auth
- bootstrap inicial de organizacao/membership
