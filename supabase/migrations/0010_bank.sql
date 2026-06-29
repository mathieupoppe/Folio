-- ─────────────────────────────────────────────────────────────────────────────
-- Folio bank connection (Phase A) — Enable Banking, read-only open banking.
-- Tables for connections, accounts, transactions, and consent sessions. Balances
-- fold into net worth; transactions (Phase B) into the activity log.
-- Run in the Supabase SQL editor (or `supabase db push`). Idempotent.
--
-- Security: everything is owner-only via RLS. The edge functions use the service
-- role (bypasses RLS) to write data they fetch from the provider. We never store
-- credentials or full IBANs — the bank authenticates the user on its own page.
-- ─────────────────────────────────────────────────────────────────────────────

-- A connection = one consent to one bank (one Enable Banking session lifecycle).
create table if not exists public.bank_connections (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles (id) on delete cascade,
  aspsp_name       text not null,                 -- bank name
  aspsp_country    text not null,                 -- ISO 3166 (e.g. BE)
  status           text not null default 'pending', -- pending|linked|expired|error
  created_at       timestamptz not null default now()
);
create index if not exists bank_conn_user_idx on public.bank_connections (user_id);

-- The consent session (returned by POST /sessions). Tells us when to reconnect.
create table if not exists public.bank_sessions (
  id            text primary key,                 -- Enable Banking session id
  connection_id uuid not null references public.bank_connections (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  valid_until   timestamptz,
  created_at    timestamptz not null default now()
);

-- One row per real bank account inside a connection.
create table if not exists public.bank_accounts (
  id                  text primary key,           -- Enable Banking account uid
  connection_id       uuid not null references public.bank_connections (id) on delete cascade,
  user_id             uuid not null references public.profiles (id) on delete cascade,
  name                text,
  iban_last4          text,                       -- last 4 only, never the full IBAN
  currency            text,
  balance             numeric,
  include_in_networth boolean not null default true,
  last_synced         timestamptz
);
create index if not exists bank_acct_user_idx on public.bank_accounts (user_id);

-- Normalised transactions. raw kept for debugging / re-categorisation.
create table if not exists public.bank_transactions (
  id          text primary key,                   -- provider transaction id (idempotent upsert)
  account_id  text not null references public.bank_accounts (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  amount      numeric not null,                   -- negative = money out
  currency    text,
  booked_at   date,
  description text,
  merchant    text,
  category    text,                               -- our auto-assigned category
  raw         jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists bank_txn_user_date_idx on public.bank_transactions (user_id, booked_at desc);
create index if not exists bank_txn_account_idx on public.bank_transactions (account_id);

-- ── RLS: owner-only on every table ────────────────────────────────────────────
alter table public.bank_connections  enable row level security;
alter table public.bank_sessions      enable row level security;
alter table public.bank_accounts      enable row level security;
alter table public.bank_transactions  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bank_connections','bank_sessions','bank_accounts','bank_transactions'] loop
    execute format('drop policy if exists %1$s_owner on public.%1$s', t);
    execute format(
      'create policy %1$s_owner on public.%1$s for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
