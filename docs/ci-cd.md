# CI/CD

## GitHub Actions

O workflow principal fica em `.github/workflows/ci.yml`.

Em pull requests para `main`, o pipeline executa:

- `npm ci`
- `npm run audit:prod`
- `npm run lint`
- `npm run test`
- `npm run build`
- dependency review
- Vercel preview deploy com comentario automatico no PR

Em push para `main`, o pipeline executa as mesmas validacoes e, se tudo passar, publica em producao na Vercel.

## Secrets obrigatorios

Configure estes secrets no repositorio GitHub:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Os valores de `VERCEL_ORG_ID` e `VERCEL_PROJECT_ID` devem corresponder ao projeto Vercel vinculado. O token deve ter acesso ao projeto.

## Estrategia Vercel

O deploy usa build precompilado:

1. `vercel pull`
2. `vercel build`
3. `vercel deploy --prebuilt`

Para producao, o pipeline usa:

1. `vercel pull --environment=production`
2. `vercel build --prod`
3. `vercel deploy --prebuilt --prod`

Isso garante que testes e build local do CI sejam gates antes do deploy.

## Dependabot

`.github/dependabot.yml` ja monitora:

- dependencias npm semanalmente
- GitHub Actions semanalmente

