# Folio — Bank Connection Plan (Enable Banking)

The automation anchor: connect a real bank, read balances + transactions, and let
them flow automatically into net worth, the activity log, budgets, and the
retention-loop money events. "When you buy something, your portfolio updates."

This plan is **read-only** (open banking AIS — account information). Folio never
moves money.

> **Provider note (2026-06):** the original plan used GoCardless Bank Account Data
> (Nordigen), but it **closed to new signups and is being wound down** — not an
> option. We're switching to **Enable Banking** (https://enablebanking.com/), the
> closest self-serve EU replacement: 2,700+ banks / 30 countries, JWT REST API.
> The architecture below is provider-agnostic — only auth + a few endpoints differ.
>
> **Pricing reality:** Enable Banking's free **"Restricted Production"** tier only
> connects **accounts you link yourself** — ideal to build, dogfood, and demo on
> Mathieu's own bank for free. Opening it to *other* users at launch needs their
> paid production tier (sales-gated). So: free to build + prove now, paid later
> when real users connect. US would be a separate adapter (Plaid/Teller).

---

## 0. What you need to do first (one-time, ~20 min)

1. Sign up at **https://enablebanking.com/** → register an **application** in their
   control panel and choose **Restricted Production** (free; works on your own
   linked accounts).
2. Enable Banking auth uses an **RSA keypair**, not a shared secret:
   - Generate a keypair: `openssl genrsa -out enablebanking_private.pem 2048`
     then `openssl rsa -in enablebanking_private.pem -pubout -out enablebanking_public.pem`.
   - Upload the **public** key in their panel; you get an **Application ID** (a UUID).
   - Keep the **private** key safe — it signs a short-lived JWT to call their API.
3. Note your **redirect URL** (your live Vercel/domain, e.g.
   `https://folio.app/?bank=callback`) — set it as an allowed redirect in the panel.

Then I'll set these as Supabase secrets (server-only, never in the browser):
```bash
supabase secrets set ENABLEBANKING_APP_ID=...  ENABLEBANKING_PRIVATE_KEY="$(cat enablebanking_private.pem)"
```

**Design constraint:** open-banking access tokens / consents are time-limited
(typically 90 days) and providers rate-limit refreshes, so we **store** everything
in our DB and **sync on a schedule** (1–2×/day), never live-fetch on every view.

---

## 1. How the connection works (the flow)

Enable Banking uses a hosted consent screen (like "Sign in with your bank"). We
authenticate to their API with a **JWT signed by our private key** (the `Authorization:
Bearer <jwt>` header), then:

```
1. (each call) build a JWT signed with the RSA private key  →  Authorization: Bearer <jwt>
2. GET  /aspsps?country=BE                         → list of banks (name, logo, id)
3. POST /auth   { aspsp, redirect_url, state=user_id, valid_until }   → { url }  (consent link)
4. User opens `url` → authenticates at their bank → redirected back with ?code=...&state=...
5. POST /sessions { code }                         → { session_id, accounts[] (uids) }
6. per account:
     GET /accounts/{uid}/details        → iban, name, currency
     GET /accounts/{uid}/balances       → current balance
     GET /accounts/{uid}/transactions   → booked[] + pending[]
```

- The signing **JWT is short-lived** (minutes) — we mint one per call server-side;
  there's no long-lived token to store, just the private key (a Supabase secret).
- **Sessions/consent expire** (~90 days) → the user re-consents periodically. We
  surface "reconnect" when a session returns expired/invalid.

---

## 2. Database (migration `0010_bank.sql`)

```sql
-- A bank connection = one GoCardless requisition (one consent, one institution).
create table bank_connections (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  requisition_id  text not null,
  institution_id  text not null,
  institution_name text,
  status          text not null default 'pending',  -- pending|linked|expired|error
  created_at      timestamptz default now()
);

-- One row per real bank account inside a connection.
create table bank_accounts (
  id            text primary key,                  -- GoCardless account id
  connection_id uuid not null references bank_connections(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  name          text,
  iban_last4    text,                              -- store only last 4, not full IBAN
  currency      text,
  balance       numeric,
  include_in_networth boolean not null default true,
  last_synced   timestamptz
);

-- Normalised transactions. raw kept for debugging / re-categorisation.
create table bank_transactions (
  id            text primary key,                  -- GoCardless transaction id (idempotent upsert)
  account_id    text not null references bank_accounts(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  amount        numeric not null,                  -- negative = money out
  currency      text,
  booked_at     date,
  description   text,
  merchant      text,
  category      text,                              -- our category (auto-assigned)
  raw           jsonb,
  created_at    timestamptz default now()
);

-- One row per linked session (Enable Banking consent), to know when to reconnect.
create table bank_sessions (
  id           text primary key,                   -- Enable Banking session id
  connection_id uuid not null references bank_connections(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  valid_until  timestamptz,
  created_at   timestamptz default now()
);
```
RLS: owner-only `select/insert/update/delete where auth.uid() = user_id` on all
user tables. No long-lived provider token to store — the API JWT is minted per
call from the private key (a Supabase secret), so there's no token table.
Everything cascades on account delete (GDPR).

---

## 3. Edge functions (Supabase, Deno)

All server-side so the GoCardless secret never reaches the browser. Each verifies
the caller's JWT (`auth.getUser()`) and acts only on that user's rows.

| Function | Job |
|---|---|
| `bank-institutions` | List banks for a country (proxy step 2) for the picker. |
| `bank-link` | Given an `institution_id`, create agreement + requisition, store a `pending` connection, return the hosted `link`. |
| `bank-finalise` | Called after redirect with the requisition ref: pull accounts (steps 6–7), insert `bank_accounts`, mark connection `linked`, do the first transaction sync. |
| `bank-sync` | Refresh balances + transactions for a user's accounts; upsert by transaction id (idempotent); update balances + `last_synced`; recategorise; emit events. Runs **on demand** and **on a daily cron** (reuse the pg_cron pattern from `notify`, respecting the 4/day limit). |

A shared `enablebanking.ts` helper signs the per-call JWT (RSA) + wraps the REST
calls. Written behind a small internal interface so a US adapter (Plaid/Teller)
can slot in later without touching the rest of the app.

---

## 4. How it folds into the existing app (the payoff)

This is the part that makes it feel automatic — we reuse the spine already built:

- **Balances → net worth.** Each `bank_accounts.balance` (where
  `include_in_networth`) sums into `totalAssets`, exactly like the live-holdings
  spine. → net worth → `nwHistory` snapshot → health score → AI coach → **money
  events** all update with zero extra work.
- **Transactions → activity log.** Each transaction becomes a log entry
  (inbound = deposit, outbound = withdrawal) with a category → powers
  **budget-vs-actual** and the **"where did my money go"** breakdown (both already
  scoped/partly built against the manual log).
- **Auto-categorisation.** A rules pass (merchant string → category) on sync;
  later an LLM fallback via the advisor function for unknowns.
- **New retention-loop events** (extend `detectEvents`): "Paycheck landed 💰"
  (large recurring inbound), "Unusual spend" (txn >> your average), "Bill due
  soon" (recurring outbound). More real moments = more reasons to return.
- **Auto-detected subscriptions** — recurring equal outbound charges fill the
  Subscriptions tracker automatically.

---

## 5. Client UI

- **Portfolio → "Connect a bank"** (new card). Opens a bank picker
  (`bank-institutions`) → on select, calls `bank-link` → opens the consent `link`
  in a browser tab.
- **Redirect back** to `?bank=callback&ref=...` → app calls `bank-finalise` →
  shows the linked accounts + balances.
- **Settings → Connected banks**: list connections, per-account
  "include in net worth" toggle, "Sync now", "Reconnect" (when expired),
  "Remove" (deletes connection + cascades).
- A **"Linked"** badge on net-worth assets that come from a bank (vs manual).

---

## 6. Security & privacy

- Read-only AIS scope — no payment/move-money capability exists.
- The Enable Banking **private key** (and the JWTs it signs) are **server-only**
  (Supabase secrets). Never shipped to the client.
- Store **minimal PII**: account name, currency, last-4 of IBAN — not the full
  IBAN, not credentials (the bank handles auth on its own hosted page).
- All tables RLS owner-only; deletion cascades on account delete (GDPR Art. 17).
- Add a line to the Privacy Policy: what bank data we store, that it's read-only,
  retention, and how to disconnect.
- Consent is time-limited by design; we never persist beyond what's needed and
  re-prompt on expiry.

---

## 7. Build order (incremental, each shippable)

1. **Phase A — Connect + balances.** Secrets, `0010_bank.sql`, `bank-institutions`
   / `bank-link` / `bank-finalise`, the connect UI, balances → net worth. This
   alone delivers "my real cash shows up automatically."
2. **Phase B — Transaction sync.** `bank-sync` + cron, transactions → activity log,
   basic merchant→category rules, the spending list.
3. **Phase C — Insights.** Budget-vs-actual, "where did my money go", auto
   subscriptions, new `detectEvents` types (paycheck/unusual spend/bill due).
4. **Phase D — Polish.** Reconnect flow, multi-account management, LLM
   categorisation fallback, Plaid (US) adapter behind the same internal interface.

---

## 8. What I need from you to start Phase A

- [ ] Enable Banking account + an **application** registered (Restricted Production).
- [ ] **Application ID** + the **RSA private key** (set as Supabase secrets via the
      command in §0 — you can do it yourself; the private key never goes in the repo).
- [ ] Your **country** (Belgium?) for the default bank list, and your **live
      redirect URL** (Vercel/custom domain) registered as an allowed redirect.

I can scaffold the **provider-agnostic** parts now (DB migration, table shapes,
client UI skeleton, the internal adapter interface) so they're ready, then wire the
Enable Banking specifics once your App ID + key exist. You deploy the functions +
apply the migration (same flow as `notify`) and connect your own bank to test.
