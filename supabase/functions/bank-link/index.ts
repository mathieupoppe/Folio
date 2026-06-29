// Start a bank connection: create a pending connection row + a hosted consent
// link the user opens to authenticate at their bank.
// Body: { name, country, redirectUrl }
// Deploy: supabase functions deploy bank-link --no-verify-jwt
import { cors, json, admin, getUser } from "../_shared/util.ts";
import { startAuth, ebConfigured } from "../_shared/enablebanking.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!ebConfigured()) return json({ error: "bank provider not configured" }, 503);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const { name, country, redirectUrl } = await req.json().catch(() => ({}));
  if (!name || !country || !redirectUrl) return json({ error: "name, country, redirectUrl required" }, 400);

  const db = admin();
  // A pending connection; we mark it linked in bank-finalise after consent.
  const { data: conn, error } = await db.from("bank_connections")
    .insert({ user_id: user.id, aspsp_name: name, aspsp_country: country, status: "pending" })
    .select("id").single();
  if (error) return json({ error: error.message }, 500);

  // 90-day consent; state carries our connection id so finalise can match it.
  const validUntil = new Date(Date.now() + 90 * 86400000).toISOString();
  try {
    const res = await startAuth({ name, country, redirectUrl, state: conn.id, validUntil });
    return json({ url: res.url, connectionId: conn.id });
  } catch (e) {
    await db.from("bank_connections").update({ status: "error" }).eq("id", conn.id);
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
