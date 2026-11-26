-- Living model budget v1: hard, persistent spend enforcement for paid
-- model-originated runs. Inactive until PORTAL_LIVING_MODEL_ENABLED=1.

create table if not exists living_model_budget (
  id integer primary key default 1,
  daily_limit_micro_usd bigint not null,
  monthly_limit_micro_usd bigint not null,
  daily_spent_micro_usd bigint not null default 0,
  monthly_spent_micro_usd bigint not null default 0,
  daily_window date not null default current_date,
  monthly_window date not null default date_trunc('month', current_date)::date,
  suspended boolean not null default false,
  updated_at timestamptz not null default now()
);
insert into living_model_budget(id,daily_limit_micro_usd,monthly_limit_micro_usd)
  values (1, 1000000, 30000000) on conflict(id) do nothing;

create table if not exists living_model_ledger (
  id bigserial primary key,
  request_id text not null unique,
  model text,
  provider text,
  micro_usd bigint not null default 0,
  status text not null,
  created_at timestamptz not null default now()
);
create index if not exists living_model_ledger_created_idx on living_model_ledger(created_at desc);
