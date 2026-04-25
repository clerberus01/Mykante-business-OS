# Parte 8: Propostas e Documentos

## Objetivo

Migrar propostas e documentos para Supabase preservando a interface atual.

## O que foi feito

- criada a tabela `public.proposals`
- criada a tabela `public.documents`
- criado o bucket privado `storage.documents`
- aplicadas policies de `storage.objects` por `organization_id`
- trocados os hooks do frontend para Supabase em:
  - `CRM` para propostas e saldo do cliente
  - `Documents` para listagem, upload, download e exclusao logica

## Comportamento adicional

- ao aceitar uma proposta, o sistema gera um lancamento financeiro pendente em `transactions`
- os documentos sao armazenados no bucket privado `documents`
- os caminhos no Storage ficam segmentados por organizacao

## Resultado esperado

Depois desta fase, o frontend passa a ler e escrever:

- propostas comerciais
- metadata de documentos
- arquivos privados no Storage

diretamente do Supabase.
