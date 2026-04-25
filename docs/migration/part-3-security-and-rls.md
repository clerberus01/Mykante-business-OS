# Parte 3: Seguranca e RLS

Objetivo: endurecer a seguranca da base no Supabase antes da migracao dos modulos de negocio.

## Migracoes aplicadas

- `supabase/migrations/0004_security_hardening.sql`
- `supabase/migrations/0005_security_policy_cleanup.sql`

## Principais medidas

### Grants

- revogados grants amplos de `anon`
- revogados grants excessivos de `authenticated`
- mantidos apenas privilegios necessarios por tabela

### Force RLS

- ativado `force row level security` nas tabelas estruturais:
  - `organizations`
  - `profiles`
  - `organization_members`
  - `audit_logs`
  - `consents`
  - `notification_preferences`

### Functions

- execucao de funcoes sensiveis restringida:
  - `bootstrap_current_user_organization` apenas para `authenticated`
  - `is_org_member` apenas para `authenticated`
  - `has_org_role` apenas para `authenticated`
- `get_auth_bootstrap_status` mantida para `anon` e `authenticated`

### Policies endurecidas

- `profiles`
  - insert e delete negados explicitamente
- `organizations`
  - delete permitido apenas para `owner`
- `organization_members`
  - insercao e update de `owner` exigem que o ator ja seja `owner`
  - delete de membership `owner` nao permitido por policy comum
- `audit_logs`
  - update e delete negados explicitamente
- `consents`
  - delete permitido apenas para `owner/admin`
- `notification_preferences`
  - delete permitido para o proprio usuario ou `owner/admin`

## Cleanup

- removidas policies duplicadas em `organization_members`

## Resultado pratico

- `anon` nao consegue operar nas tabelas estruturais
- `authenticated` so consegue agir dentro do escopo permitido por RLS
- a base esta pronta para receber tabelas de negocio com padrao `organization_id`

## Impacto nas proximas etapas

Ao migrar CRM, projetos, financeiro e documentos:

- todas as tabelas devem incluir `organization_id`
- toda leitura/escrita deve passar por membership ativo
- logs criticos devem ir para `audit_logs`
- dados sensiveis devem seguir a mesma estrategia de minimizacao e segregacao
