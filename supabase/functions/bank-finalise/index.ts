// Finish a connection after the user returns from the bank's consent page.
// Body: { code, connectionId }  (code + state from the redirect URL)
// Exchanges the code for a session, stores the accounts + current balances, and
// marks the connection linked. Transactions arrive in Phase B (bank-sync).
// Deploy: supabase functions deploy bank-finalise --no-verify-jwt
import { cors, json, admin, getUser } from "../_shared/util.ts";
import { createSession, getAccountDetails, getBalances, ebConfigured } from "../_shared/enablebanking.ts";

// Pull a usable current balance out of the /balances response (defensive: the
// exact shape varies by bank, so we try the common fields and fall back).
function pickBalance(balances: any): number | null {
  const list = balances?.balances || balances || [];
  if (!Array.isArray(list) || !list.length) return null;
  const pref = list.find((b: any) => ["CLBD", "closingBooked", "expected", "XPCD"].includes(b.balance_type)) || list[0];
  const amt = pref?.balance_amount?.amount ?? pref?.amount;
  return amt != null ? Number(amt) : null;
}
function pickCurrency(balances: any, details: any): string | null {
  const list = balances?.balances || [];
  return list[0]?.balance_amount?.currency || details?.currency || null;
}
function ibanLast4(details: any): string | null {
  const iban = details?.account_id?.iban || details?.iban || "";
  return iban ? String(iban).slice(-4) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!ebConfigured()) return json({ error: "bank provider not configured" }, 503);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const { code, connectionId } = await req.json().catch(() => ({}));
  if (!code || !connectionId) return json({ error: "code and connectionId required" }, 400);

  const db = admin();
  // Make sure this connection belongs to the caller.
  const { data: conn } = await db.from("bank_connections")
    .select("id, user_id").eq("id", connectionId).eq("user_id", user.id).maybeSingle();
  if (!conn) return json({ error: "connection not found" }, 404);

  try {
    const session = await createSession(code);
    const sessionId = session.session_id || session.id;
    const accounts = session.accounts || [];

    await db.from("bank_sessions").upsert({
      id: sessionId, connection_id: connectionId, user_id: user.id,
      valid_until: session.access?.valid_until || null,
    });

    const stored: string[] = [];
    for (const a of accounts) {
      const uid = typeof a === "string" ? a : (a.uid || a.account_uid || a.id);
      if (!uid) continue;
      let details: any = {}, balances: any = {};
      try { details = await getAccountDetails(uid); } catch { /* keep going */ }
      try { balances = await getBalances(uid); } catch { /* keep going */ }
      await db.from("bank_accounts").upsert({
        id: uid, connection_id: connectionId, user_id: user.id,
        name: details?.name || details?.product || "Account",
        iban_last4: ibanLast4(details),
        currency: pickCurrency(balances, details),
        balance: pickBalance(balances),
        last_synced: new Date().toISOString(),
      });
      stored.push(uid);
    }

    await db.from("bank_connections").update({ status: "linked" }).eq("id", connectionId);
    return json({ ok: true, accounts: stored.length });
  } catch (e) {
    await db.from("bank_connections").update({ status: "error" }).eq("id", connectionId);
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
