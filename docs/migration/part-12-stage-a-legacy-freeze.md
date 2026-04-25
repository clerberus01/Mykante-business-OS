# Parte 12 - Etapa A: Congelar o legado

## Objetivo

Remover o restante do legado Firebase do projeto ativo, agora que os modulos funcionais ja usam Supabase.

## O que foi removido

- `src/lib/firebase.ts`
- `src/hooks/useFirebase.ts`
- `firebase-applet-config.json`
- `firebase-blueprint.json`
- `firestore.rules`
- `DRAFT_firestore.rules`
- dependencia `firebase` de `package.json`

## O que foi ajustado

- `src/contexts/AuthContext.tsx`
  - removeu a sessao anonima legada
  - removeu o encerramento de sessao Firebase no logout
- `package-lock.json`
  - sincronizado sem os pacotes do Firebase
- `postcss.config.js`
  - criado localmente para evitar interferencia de um `D:\postcss.config.js` externo ao projeto durante a build

## Resultado

- o projeto ativo nao depende mais de Firebase para autenticacao, dados ou build
- `npm run lint`: ok
- `npm run build`: ok

## Observacao

Ainda existe uma subpasta separada criada por engano (`Mykante-business-OS`) com arquivos antigos de Firebase. Ela nao faz parte do projeto ativo em `D:\MBOS` e nao foi alterada nesta etapa.
