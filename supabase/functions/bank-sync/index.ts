// Refresh balances for the caller's linked bank accounts (Phase A). Called from
// the app ("Sync now") and later on a daily cron (respecting provider rate
// limits). Phase B extends this to upsert transactions into bank_transactions.
// Deploy: supabase functions deploy bank-sync --no-verify-jwt
import { cors, json, admin, getUser } from "../_shared/util.ts";
import { getBalances, ebConfigured } from "../_shared/enablebanking.ts";

function pickBalance(balances: any): number | null {
  const list = balances?.balances || balances || [];
  if (!Array.isArray(list) || !list.length) return null;
  const pref = list.find((b: any) => ["CLBD", "closingBooked", "expected", "XPCD"].includes(b.balance_type)) || list[0];
  const amt = pref?.balance_amount?.amount ?? pref?.amount;
  return amt != null ? Number(amt) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!ebConfigured()) return json({ error: "bank provider not configured" }, 503);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const db = admin();
  const { data: accounts } = await db.from("bank_accounts").select("id").eq("user_id", user.id);
  if (!accounts?.length) return json({ synced: 0 });

  let synced = 0;
  for (const a of accounts) {
    try {
      const balances = await getBalances(a.id);
      const bal = pickBalance(balances);
      if (bal != null) {
        await db.from("bank_accounts").update({ balance: bal, last_synced: new Date().toISOString() }).eq("id", a.id);
        synced++;
      }
      // TODO Phase B: const txns = await getTransactions(a.id, sinceDate);
      //   upsert into bank_transactions (idempotent by provider id) + categorise.
    } catch { /* skip this account, continue */ }
  }
  return json({ synced });
});
