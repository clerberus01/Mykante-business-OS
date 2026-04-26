# Parte 0: Preparacao

Objetivo: preparar o projeto para a migracao para Supabase sem alterar o design atual.

## Resultado esperado

- dependencia do Supabase instalada
- variaveis de ambiente definidas para frontend e backend
- helper base do Supabase para Vite criado
- estrutura local de migracoes criada
- mapa funcional do sistema registrado

## Mapa funcional atual

### Autenticacao

- origem na epoca da preparacao: provedor legado de autenticacao
- arquivos principais:
  - `src/contexts/AuthContext.tsx`
  - `src/pages/Login.tsx`

### CRM

- entidades:
  - clients
  - client events
- arquivos principais:
  - `src/pages/CRM.tsx`
  - `src/components/ClientModal.tsx`
  - `src/components/Timeline.tsx`
  - `src/hooks/supabase/useClients.ts`

### Projetos

- entidades:
  - projects
  - milestones
  - tasks
  - project activity
- arquivos principais:
  - `src/pages/Projects.tsx`
  - `src/pages/ProjectDetail.tsx`
  - `src/components/ProjectModal.tsx`
  - `src/components/ProjectCard.tsx`
  - `src/components/TaskItem.tsx`

### Financeiro

- entidades:
  - transactions
  - proposal acceptance side effects
- arquivos principais:
  - `src/pages/Finance.tsx`
  - `src/components/TransactionModal.tsx`
  - `src/hooks/supabase/useFinance.ts`

### Propostas

- entidades:
  - proposals
- arquivos principais:
  - `src/pages/CRM.tsx`
  - `src/hooks/supabase/useProposals.ts`

### Documentos

- estado atual:
  - interface presente
  - armazenamento ainda nao integrado
- arquivos principais:
  - `src/pages/Documents.tsx`
  - `src/pages/ProjectDetail.tsx`

### Comunicacoes

- estado atual:
  - dados mockados
  - sem backend real
- arquivos principais:
  - `src/pages/Communications.tsx`

### Dashboard

- estado atual:
  - mockado
- arquivos principais:
  - `src/pages/Dashboard.tsx`
  - `src/constants.ts`

## Riscos mapeados

- regras de permissao e negocio no frontend
- autenticacao originalmente acoplada ao provedor legado
- dados sensiveis sem estrutura LGPD no banco
- partes do produto ainda mockadas
- arquivos legados ainda presentes no repositorio no momento da preparacao

## Proxima etapa

Parte 1: schema base do Supabase

- organizations
- profiles
- organization_members
- audit_logs
- consents
- notification_preferences
- RLS inicial
