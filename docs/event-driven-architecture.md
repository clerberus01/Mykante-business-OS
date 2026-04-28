# Event-Driven Architecture

## Objetivo

A arquitetura de eventos usa o Postgres/Supabase como fonte de verdade. Escritas nos modulos principais geram registros append-only em `public.domain_events`.

## Fluxo

1. Uma tabela de negocio recebe `insert`, `update` ou `delete`.
2. A trigger `public.emit_domain_event()` cria um evento em `public.domain_events`.
3. Supabase Realtime publica inserts de `domain_events` para clientes autenticados da mesma organizacao.
4. A trigger `public.queue_domain_event_webhooks()` cria entregas pendentes em `public.event_webhook_deliveries` para endpoints ativos.
5. O cron `/api/events/process-webhooks` processa a fila e envia webhooks assinados.

## Tabelas

- `domain_events`: barramento append-only por organizacao.
- `event_webhook_endpoints`: endpoints HTTPS cadastrados por owner/admin.
- `event_webhook_deliveries`: fila de entrega com retry e historico de resposta.

## Assinatura

Cada webhook recebe:

- `X-Mykante-Event`
- `X-Mykante-Event-Id`
- `X-Mykante-Delivery-Id`
- `X-Mykante-Signature`

O payload assinado usa o formato `timestamp.body`, com HMAC SHA-256 e o secret do endpoint. O header tem o formato `t=<unix>,v1=<hex>`.

## Realtime

`public.domain_events` fica na publication `supabase_realtime`. O frontend assina apenas eventos da organizacao atual e invalida caches TanStack Query relacionados ao modulo afetado.

## Seguranca

- Eventos e webhooks respeitam `organization_id`.
- `domain_events` e entregas sao append-only para usuarios normais.
- Segredos e tokens sao redigidos pelo mesmo padrao do audit log.
- O processador de webhooks exige `CRON_SECRET`.
