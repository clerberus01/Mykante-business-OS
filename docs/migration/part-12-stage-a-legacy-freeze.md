# Parte 12 - Etapa A: Congelar o legado

## Objetivo

Remover o restante do legado do projeto ativo, agora que os modulos funcionais ja usam Supabase.

## O que foi removido

- camada antiga de autenticacao e dados
- configuracoes antigas do provedor substituido
- regras antigas do banco substituido
- dependencia antiga removida de `package.json`

## O que foi ajustado

- `src/contexts/AuthContext.tsx`
  - removeu a sessao anonima legada
  - removeu o encerramento de sessao do provedor antigo no logout
- `package-lock.json`
  - sincronizado sem os pacotes do provedor antigo
- `postcss.config.js`
  - criado localmente para evitar interferencia de um `D:\postcss.config.js` externo ao projeto durante a build

## Resultado

- o projeto ativo nao depende mais do provedor antigo para autenticacao, dados ou build
- `npm run lint`: ok
- `npm run build`: ok

## Observacao

Ainda existe uma subpasta separada criada por engano (`Mykante-business-OS`) com arquivos antigos do provedor substituido. Ela nao faz parte do projeto ativo em `D:\MBOS` e nao foi alterada nesta etapa.
