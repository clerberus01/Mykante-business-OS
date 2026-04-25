# Parte 4: Camada de Dados no Frontend

## Objetivo

Preparar a substituicao do Firebase por Supabase no frontend sem alterar o design e sem trocar as telas ainda.

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
  - hooks equivalentes aos hooks legados do Firebase

## Decisao de arquitetura

O frontend atual usa tipos baseados em timestamps numericos e estruturas pensadas para Firestore. Em vez de mudar as telas agora, a nova camada converte:

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

As proximas fases podem migrar modulo por modulo apenas trocando imports:

- de `src/hooks/useFirebase.ts`
- para `src/hooks/supabase`

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
