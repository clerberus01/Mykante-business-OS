# Parte 6: Projetos

## Objetivo

Migrar o modulo de projetos para Supabase preservando a interface atual.

## O que foi feito

- criadas as tabelas:
  - `public.projects`
  - `public.milestones`
  - `public.tasks`
  - `public.project_activity`
- aplicado `RLS` por `organization_id`
- adicionados indices para listagem por projeto, status e ordem
- preservado soft delete apenas em `projects`
- trocados os hooks do frontend para Supabase em:
  - `Projects`
  - `ProjectDetail`
  - `ProjectModal`

## O que continua legado

- `transactions` no detalhe do projeto ainda permanecem no legado
- repositorio de arquivos do projeto ainda e mockado na interface

## Resultado esperado

Depois desta fase, o frontend passa a criar e ler:

- projetos
- etapas
- tarefas
- log de atividade

diretamente do Supabase.
