# Parte 7: Financeiro

## Objetivo

Migrar o modulo financeiro para Supabase preservando a interface atual.

## O que foi feito

- criada a tabela `public.transactions`
- aplicada `RLS` por `organization_id`
- adicionados indices para consulta por data, status, tipo, cliente e projeto
- mantido `soft delete` na estrutura da tabela
- trocados os hooks do frontend para Supabase em:
  - `Finance`
  - `TransactionModal`
  - aba financeira de `ProjectDetail`

## Estrutura da tabela

- `type`: `income | expense`
- `status`: `pending | liquidated | cancelled`
- vinculo opcional com:
  - `clients`
  - `projects`
- suporte preparado para:
  - recorrencia
  - anexo de comprovante

## Resultado esperado

Depois desta fase, o frontend passa a criar, listar e atualizar:

- lancamentos financeiros
- cobrancas por cliente
- fluxo financeiro por projeto

diretamente do Supabase.
