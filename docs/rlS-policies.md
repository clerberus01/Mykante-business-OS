# RLS Policies

Documento central de Row Level Security do Mykante Business OS.

Estado revisado em 2026-04-28: todas as tabelas base do schema `public` devem ter `ENABLE ROW LEVEL SECURITY` e `FORCE ROW LEVEL SECURITY`. A migração `0030_enable_force_rls_all_public_tables.sql` reaplica essa garantia de forma idempotente sem alterar o design, as telas ou as regras funcionais existentes.

## Principios

- O frontend usa apenas credenciais publicas/anonimas e depende de RLS para isolamento entre organizacoes.
- Chaves `service_role` so podem existir em codigo server-side, Edge Functions, Vercel Functions ou rotinas administrativas.
- Tabelas com `organization_id` devem restringir acesso por `public.is_org_member(organization_id)` ou `public.has_org_role(...)`.
- Tabelas com registros historicos, auditoria ou eventos devem ser append-only sempre que possivel.
- Deletes fisicos devem ser negados ou limitados a donos/admins; fluxos normais devem preferir soft delete quando a tabela possuir `deleted_at`.
- Toda nova tabela publica precisa entrar neste documento e receber RLS antes de ser consumida pelo frontend.

## Funcoes de apoio

- `public.is_org_member(org_id uuid)`: confirma se o usuario autenticado possui membership ativo na organizacao.
- `public.has_org_role(org_id uuid, roles text[])`: confirma membership ativo e papel permitido.
- `public.current_org_role(org_id uuid)`: retorna o papel ativo do usuario autenticado dentro da organizacao.
- `public.has_org_permission(org_id uuid, permission text)`: centraliza permissoes RBAC por organizacao.
- `public.is_mfa_verified()`: confirma que o JWT da sessao autenticada esta em `aal2`; os helpers de organizacao dependem dessa verificacao.
- `public.bootstrap_current_user_organization(...)`: fluxo controlado para criacao inicial da organizacao/proprietario.
- `public.get_auth_bootstrap_status()`: informa se o bootstrap inicial ainda esta disponivel.

## MFA obrigatorio

O CRM exige Supabase Auth com MFA TOTP antes de liberar dados internos:

- O frontend bloqueia o shell autenticado quando `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` nao retorna `aal2`.
- Contas sem fator verificado sao direcionadas ao cadastro TOTP antes de carregar organizacao, CRM, financeiro, projetos ou documentos.
- Contas com fator verificado precisam concluir o desafio TOTP a cada nova sessao que voltar como `aal1`.
- Vercel Functions autenticadas rejeitam tokens sem claim `aal2`.
- RLS tambem exige `aal2` via `public.is_mfa_verified()`, impedindo acesso direto ao Supabase com sessao apenas por senha.

## RBAC por organizacao

Os perfis sao atribuidos em `organization_members.role`, sempre no contexto de uma organizacao especifica:

| Papel | Uso previsto |
| --- | --- |
| `owner` | Controle total da organizacao, incluindo exclusao, remocao de membros e concessao de novo owner. |
| `admin` | Administracao operacional da organizacao e membros, sem poder remover o ultimo owner nem conceder owner sem ja ser owner. |
| `manager` | Gestao de areas sensiveis como auditoria/LGPD quando a policy permitir. |
| `operator` | Operacao normal do CRM, projetos, financeiro, documentos, calendario e WhatsApp dentro da organizacao. |

Permissoes centralizadas em `public.has_org_permission(...)`:

| Permissao | Papeis permitidos |
| --- | --- |
| `organization:read`, `members:read` | Qualquer membro ativo |
| `organization:update`, `members:invite`, `members:update`, `notifications:manage` | `owner`, `admin` |
| `audit:read`, `lgpd:manage` | `owner`, `admin`, `manager` |
| `organization:delete`, `members:delete`, `members:grant_owner` | `owner` |
| `crm:manage`, `projects:manage`, `finance:manage`, `documents:manage`, `calendar:manage`, `whatsapp:manage` | Qualquer membro ativo, preservando o comportamento atual |

A trigger `prevent_last_org_owner_loss` impede update/delete em `organization_members` que deixaria a organizacao sem nenhum `owner` ativo.

## Identidade e organizacoes

| Tabela | Leitura | Insercao | Atualizacao | Exclusao | Observacao |
| --- | --- | --- | --- | --- | --- |
| `profiles` | Proprio usuario | Negada no browser | Proprio usuario | Negada | Perfil e identidade do usuario autenticado. |
| `organizations` | Membros ativos | Bootstrap/controlada | Admin/owner | Owner | Escopo principal de tenant. |
| `organization_members` | Membros da organizacao | Owner/admin | Owner/admin | Owner | Owner nao deve ser removido por fluxo comum. |

## CRM e propostas

| Tabela | Leitura | Insercao | Atualizacao | Exclusao | Observacao |
| --- | --- | --- | --- | --- | --- |
| `clients` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Negada | Cadastro principal de cliente. |
| `client_events` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Negada | Historico do cliente. |
| `crm_pipeline_stages` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Etapas do funil por organizacao. |
| `crm_deals` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Deve validar cliente/organizacao por FK e policy. |
| `proposals` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Portal publico usa token/link controlado, nao acesso aberto a tabela. |

## Projetos e tarefas

| Tabela | Leitura | Insercao | Atualizacao | Exclusao | Observacao |
| --- | --- | --- | --- | --- | --- |
| `projects` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Escopo por `organization_id`. |
| `milestones` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Vinculada a projeto/organizacao. |
| `tasks` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Vinculada ao projeto/organizacao. |
| `task_checklist_items` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Herdada da tarefa/projeto. |
| `project_time_entries` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Lancamentos de tempo por projeto. |
| `project_activity` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Preferencialmente append-only. |

## Financeiro

| Tabela | Leitura | Insercao | Atualizacao | Exclusao | Observacao |
| --- | --- | --- | --- | --- | --- |
| `transactions` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Deve manter isolamento por cliente/organizacao. |
| `finance_categories` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Categorias financeiras por tenant. |
| `cost_centers` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Centros de custo por tenant. |
| `bank_statement_imports` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Importacoes bancarias por tenant. |
| `bank_statement_lines` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Linhas devem herdar o escopo da importacao. |
| `payment_requests` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Solicitacoes de pagamento por tenant. |

## Calendario

| Tabela | Leitura | Insercao | Atualizacao | Exclusao | Observacao |
| --- | --- | --- | --- | --- | --- |
| `calendar_events` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Eventos por organizacao. |
| `calendar_event_attendees` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Escopo herdado do evento. |
| `calendar_booking_links` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Links de agendamento controlados. |
| `calendar_external_sync_accounts` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Conforme policy existente | Contas externas por tenant. |

## Documentos, LGPD, auditoria e notificacoes

| Tabela | Leitura | Insercao | Atualizacao | Exclusao | Observacao |
| --- | --- | --- | --- | --- | --- |
| `documents` | Membros da organizacao | Membros da organizacao | Membros da organizacao | Negada ou restrita | Arquivos e metadados por tenant. |
| `audit_logs` | Admin/manager | Usuario autenticado/servidor | Negada | Negada | Auditoria append-only. |
| `consents` | Usuario dono ou gestor | Usuario dono ou gestor | Usuario dono ou gestor | Admin | Registro de consentimentos. |
| `data_retention_policies` | Gestores autorizados | Restrita | Restrita | Restrita | Politicas de retencao. |
| `data_subject_requests` | Usuario dono ou gestor | Usuario dono ou gestor | Usuario dono ou gestor | Conforme policy existente | Requisicoes LGPD. |
| `notification_preferences` | Usuario dono ou admin | Usuario dono ou admin | Usuario dono ou admin | Usuario dono ou admin | Preferencias por usuario. |
| `notification_subscriptions` | Usuario dono ou admin | Usuario dono ou admin | Usuario dono ou admin | Conforme policy existente | Assinaturas push. |
| `notification_dispatches` | Gestores autorizados | Servidor/fluxo autorizado | Negada ou restrita | Negada | Historico operacional. |

## WhatsApp

| Tabela | Leitura | Insercao | Atualizacao | Exclusao | Observacao |
| --- | --- | --- | --- | --- | --- |
| `whatsapp_conversations` | Membros da organizacao | Membros da organizacao/servidor | Membros da organizacao/servidor | Conforme policy existente | Conversas por tenant. |
| `whatsapp_messages` | Membros da organizacao | Servidor/fluxo autorizado | Negada ou restrita | Negada | Mensagens herdam escopo da conversa. |

## Storage

- Buckets com dados de organizacao devem validar o caminho do objeto contra membership ativo.
- Avatares de clientes ficam no bucket `client-avatars`; upload e remocao passam pelo fluxo autenticado e escopo do cliente/organizacao.
- Buckets publicos so devem armazenar ativos nao sensiveis ou arquivos projetados para acesso publico.

## Checklist para novas tabelas

1. Criar a tabela com `organization_id` quando houver dado multi-tenant.
2. Habilitar `ENABLE ROW LEVEL SECURITY`.
3. Habilitar `FORCE ROW LEVEL SECURITY`.
4. Criar policies para `select`, `insert`, `update` e `delete`, mesmo que a policy seja `false`.
5. Validar dados no server-side quando a acao passar por API, Edge Function ou webhook.
6. Registrar a tabela neste documento antes de liberar uso no frontend.
