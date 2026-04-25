# Parte 4: Camada de Dados no Frontend

## Objetivo

Preparar a consolidacao da camada Supabase no frontend sem alterar o design e sem trocar as telas ainda.

## O que foi criado

- `src/services/shared`
  - erros padronizados da camada de dados
  - helpers de mapeamento entre ISO date e timestamp numerico do frontend
  - classe base para repositórios Supabase
- `src/services/clients/clientRepository.ts`
- `src/services/projects/projectRepository.ts`
- `src/services/finance/transactionRepository.ts`
- `src/services/proposals/proposalRepository.ts`
- `src/hooks/supabase`
  - hooks equivalentes aos contratos usados pelas telas

## Decisao de arquitetura

O frontend atual usa tipos baseados em timestamps numericos e estruturas legadas do modelo anterior. Em vez de mudar as telas agora, a nova camada converte:

- linhas do Postgres/Supabase
- campos `snake_case`
- datas ISO

para os mesmos objetos esperados pelas telas:

- `Client`
- `TimelineEvent`
- `Project`
- `Milestone`
- `Task`
- `ActivityLog`
- `Proposal`
- `Transaction`

## Resultado pratico

As fases seguintes puderam migrar modulo por modulo trocando a camada de dados para `src/hooks/supabase`, sem alterar o design das telas.

## Pendencias esperadas

Esta camada assume a existencia futura das tabelas de negocio no Supabase:

- `clients`
- `client_events`
- `projects`
- `milestones`
- `tasks`
- `project_activity`
- `proposals`
- `transactions`

Enquanto essas tabelas nao forem criadas na base, os hooks Supabase devem permanecer desacoplados das telas.
