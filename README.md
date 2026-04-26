# Mykante Business OS

Mykante Business OS é um sistema operacional de gestão para operações de serviços, reunindo CRM, projetos, finanças, documentos, calendário, comunicações e configurações administrativas em uma única interface.

## Visão Do Produto

O produto centraliza a rotina comercial e operacional da empresa:

- acompanhar clientes, oportunidades e histórico de relacionamento;
- organizar projetos, tarefas, checklist, responsáveis, progresso e apontamento de tempo;
- controlar transações financeiras ligadas a clientes, propostas e projetos;
- manter documentos e comunicações conectados ao contexto da operação;
- operar com multi-tenancy por organização e políticas RLS no Supabase.

## Stack

- Vite + React + TypeScript
- Tailwind CSS
- Supabase Auth, Database, Storage e RLS
- TanStack Query para cache, mutações e invalidação de dados
- Zod para validação de dados de repositórios
- Vitest + Testing Library para testes
- Vercel para build, funções serverless e deploy

## Módulos

- Dashboard: visão executiva de clientes, projetos, tarefas e finanças.
- CRM: clientes, timeline, propostas, pipeline Kanban e histórico automático de WhatsApp.
- Projetos: etapas, tarefas, responsáveis, checklist, time tracking, progresso automático e notificações.
- Finanças: transações, status de pagamento e integrações com propostas/projetos.
- Comunicações: conversas e mensagens de WhatsApp com envio por API.
- Documentos: upload, organização, download assinado e soft delete.
- Calendário: agenda operacional com navegação contextual.
- Configurações: perfil, foto, organização, notificações, privacidade, segurança e status de integrações.

## Screenshot / Demo

- Projeto Vercel: `mykante-business-os`
- Demo pública: definir com o domínio de produção após o próximo deploy Vercel.
- Screenshot: adicionar captura da tela principal após validação do deploy.

## Roadmap

- Migrar a navegação principal para TanStack Router mantendo o comportamento visual atual.
- Concluir a padronização de todos os hooks de dados com TanStack Query.
- Expandir testes de repositórios, hooks e fluxos críticos.
- Evoluir WhatsApp com fila dedicada, templates oficiais e atualizações realtime.
- Ampliar relatórios e automações em Finanças e Projetos.
- Criar automação de deploy pós-merge para Vercel.

## Desenvolvimento Local

**Pré-requisitos:** Node.js 20+ e variáveis Supabase configuradas.

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Configure `.env.local` com as variáveis necessárias:
   ```bash
   VITE_SUPABASE_URL=
   VITE_SUPABASE_PUBLISHABLE_KEY=
   SUPABASE_PROJECT_URL=
   SUPABASE_SERVICE_ROLE_KEY=
   ```

3. Rode o servidor:
   ```bash
   npm run dev
   ```

4. Valide antes de publicar:
   ```bash
   npm run lint
   npm run test
   npm run build
   ```

## Como Contribuir

1. Abra uma branch curta a partir de `main`.
2. Mantenha mudanças pequenas e focadas no módulo alterado.
3. Preserve o design e o funcionamento existente salvo quando houver permissão explícita.
4. Rode lint, testes e build antes de abrir pull request.
5. Descreva impacto em banco, RLS, variáveis de ambiente e fluxos afetados.
