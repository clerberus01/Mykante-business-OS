# Parte 5: CRM

## Objetivo

Migrar o modulo de CRM para Supabase sem alterar o design da tela e sem forcar a migracao de propostas e financeiro no mesmo passo.

## O que foi feito

- criadas as tabelas `public.clients` e `public.client_events`
- adicionados indices de busca e unicidade por organizacao
- aplicado soft delete em `clients` com `deleted_at`
- ativado `RLS` com escopo por `organization_id`
- mantida a tela de CRM atual, trocando apenas:
  - `useClients`
  - `useEvents`

## Regras principais

- apenas membros da organizacao podem ler ou gravar clientes e eventos
- exclusao fisica de clientes fica negada por policy
- eventos do cliente ficam amarrados ao mesmo `organization_id` do cliente por chave composta

## O que ainda fica legado nesta tela

Para reduzir risco e manter o contexto controlado, a tela de CRM continua usando o legado apenas para:

- `proposals`
- `transactions`

Esses dois pontos entram nas fases seguintes.

## Resultado esperado

Depois desta fase, o CRM passa a:

- listar clientes do Supabase
- criar cliente no Supabase
- editar cliente no Supabase
- soft delete no Supabase
- registrar timeline no Supabase
- remover eventos de timeline no Supabase
