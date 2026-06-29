// List banks (ASPSPs) for a country, for the connect-a-bank picker.
// Deploy: supabase functions deploy bank-institutions --no-verify-jwt
import { cors, json, getUser } from "../_shared/util.ts";
import { listAspsps, ebConfigured } from "../_shared/enablebanking.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!ebConfigured()) return json({ error: "bank provider not configured" }, 503);
  const user = await getUser(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));
  const country = (body?.country || url.searchParams.get("country") || "BE").toUpperCase();
  try {
    const aspsps = await listAspsps(country);
    // Trim to what the picker needs.
    const banks = aspsps.map((a: Record<string, unknown>) => ({
      name: a.name, country: a.country, logo: a.logo,
    }));
    return json({ banks });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 502);
  }
});
