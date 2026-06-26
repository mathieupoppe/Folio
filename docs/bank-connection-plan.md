# Folio — Bank Connection Plan (GoCardless Bank Account Data)

The automation anchor: connect a real bank, read balances + transactions, and let
them flow automatically into net worth, the activity log, budgets, and the
retention-loop money events. "When you buy something, your portfolio updates."

This plan is **read-only** (open banking AIS — account information). Folio never
moves money. Provider: **GoCardless Bank Account Data** (formerly Nordigen) — free
tier, EU/UK coverage, no per-call cost. US (Plaid) is a later, separate adapter.

---

## 0. What you need to do first (one-time, ~15 min)

1. Sign up at **https://bankaccountdata.gocardless.com/** (free, separate from the
   GoCardless payments product). Pick your region.
2. In the portal → **Developers → User secrets** → create a secret. You get a
   **`secret_id`** and **`secret_key`**. Copy both (the key is shown once).
3. That's it — no redirect URL to pre-register (we pass it per-request).

Then I'll set them as Supabase secrets (server-only, never in the browser):
```bash
supabase secrets set GOCARDLESS_SECRET_ID=...  GOCARDLESS_SECRET_KEY=...
```

**Free-tier limits that shape the design:** ~4 transaction/balance pulls **per
account per day** (then HTTP 429). So we **store** everything in our DB and
**sync on a schedule** (1–2×/day), never live-fetch on every screen view.

---

## 1. How the connection works (the flow)

GoCardless uses a hosted consent screen (like "Sign in with your bank"):

```
1. GET  /api/v2/token/new/            (secret_id + secret_key)  → access + refresh token
2. GET  /api/v2/institutions/?country=BE                        → list of banks (+ logos, ids)
3. POST /api/v2/agreements/enduser/   (institution, 90d history, 90d access)   → agreement id
4. POST /api/v2/requisitions/         (institution, agreement, redirect, reference=user_id)
                                                                → { id, link }
5. User opens `link` → authenticates at their bank → redirected back to Folio with ?ref=...
6. GET  /api/v2/requisitions/{id}/                              → status + accounts[] (ids)
7. per account:
     GET /api/v2/accounts/{id}/details/      → iban, name, currency
     GET /api/v2/accounts/{id}/balances/     → current balance
     GET /api/v2/accounts/{id}/transactions/ → booked[] + pending[]
```

- **Access token** lives ~24h, **refresh token** ~30d → we cache + refresh server-side.
- **Requisitions expire** (consent is time-limited, ~90 days) → the user re-consents
  periodically. We surface "reconnect" when status flips to expired.

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

-- Server-side GoCardless token cache (single row, service-role only).
create table gocardless_token (
  id integer primary key default 1,
  access_token text, access_expires timestamptz,
  refresh_token text, refresh_expires timestamptz
);
```
RLS: owner-only `select/insert/update/delete where auth.uid() = user_id` on the
three user tables; `gocardless_token` has **no policies** (only the service-role
edge functions touch it). Everything cascades on account delete (GDPR).

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

A shared `gocardless.ts` helper handles token fetch/refresh + the REST calls.

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
- GoCardless secret + tokens are **server-only** (Supabase secrets + service-role
  table). Never shipped to the client.
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

- [ ] GoCardless Bank Account Data account created.
- [ ] `secret_id` + `secret_key` (I'll set them as Supabase secrets — paste them
      when ready, or set them yourself with the command in §0).
- [ ] Your country (for the default institution list) and the live redirect URL
      (your Vercel/custom domain) so the consent screen returns to the right place.

Once those exist, I build Phase A end-to-end (DB + functions + UI), you deploy the
functions + apply the migration (same flow as `notify`), and you connect your own
bank to test.
