do $$
declare
  constraint_name text;
begin
  select conname
  into constraint_name
  from pg_constraint
  where conrelid = 'public.transactions'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%payment_provider%';

  if constraint_name is not null then
    execute format('alter table public.transactions drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.transactions
add constraint transactions_payment_provider_check
check (payment_provider in ('pagseguro', 'manual'));

alter table public.payment_requests
alter column provider set default 'pagseguro';

update public.transactions
set payment_provider = 'pagseguro'
where payment_provider = 'asaas';

update public.payment_requests
set provider = 'pagseguro',
    provider_payment_id = replace(provider_payment_id, 'asaas_', 'pagseguro_'),
    payment_url = replace(payment_url, 'https://sandbox.asaas.com/pay/', 'https://sandbox.pagseguro.uol.com.br/checkout/')
where provider = 'asaas';
