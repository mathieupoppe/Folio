// Deletes the calling user's account. The user's folio data row is removed
// automatically via the ON DELETE CASCADE on folio.user_id -> auth.users.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // identify the caller from their access token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) return json({ error: "Invalid session" }, 401);

    // delete the user (cascades to their folio row)
    const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ success: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
