// Folio retention loop — scheduled push sender. Runs server-side (no browser
// open needed): for every user with a push subscription, it recomputes their
// money events from the synced blob, and for any NEW milestone it hasn't pushed
// before, sends one Web Push notification ("Your net worth just crossed €100k —
// share it?"). Dedup via profiles.pushed_events so each milestone pings once.
//
// Deploy:
//   supabase secrets set VAPID_PUBLIC_KEY=...  VAPID_PRIVATE_KEY=...  \
//                        VAPID_SUBJECT=mailto:you@folio.app  CRON_SECRET=<random>
//   supabase functions deploy notify
//
// Schedule it daily with pg_cron (run once in the SQL editor):
//   select cron.schedule('folio-notify','0 9 * * *', $$
//     select net.http_post(
//       url    := 'https://<project-ref>.functions.supabase.co/notify',
//       headers:= jsonb_build_object('x-cron-secret','<the CRON_SECRET>'),
//       body   := '{}'::jsonb) $$);
// (Enable the pg_cron + pg_net extensions first under Database → Extensions.)
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { detectEvents } from "./events.ts";

const sum = (xs: { amount?: number }[] = []) => xs.reduce((s, x) => s + (x.amount || 0), 0);

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const body = await req.json().catch(() => ({}));
  const isCron = req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:hello@folio.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

  // ── Test path: a signed-in user pings their own devices to verify delivery ──
  if (body?.test) {
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);
    const { data: mine } = await supabase.from("push_subscriptions").select("endpoint, keys").eq("user_id", user.id);
    if (!mine?.length) return json({ sent: 0, hint: "no subscription on this account yet" });
    const payload = JSON.stringify({ title: "Folio", body: "Test notification ✅ Push is working.", url: "/", tag: "folio-test" });
    let sent = 0;
    for (const s of mine) {
      try { await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as any }, payload); sent++; }
      catch (err) { const code = (err as { statusCode?: number })?.statusCode; if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint); }
    }
    return json({ sent });
  }

  // ── Cron path: scheduled scan of everyone's money events ────────────────────
  if (!isCron) return json({ error: "forbidden" }, 403);

  // Only users who actually have a subscription are worth processing.
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, user_id, keys");
  if (!subs?.length) return new Response(JSON.stringify({ sent: 0 }), { headers: { "Content-Type": "application/json" } });

  const byUser: Record<string, { endpoint: string; keys: unknown }[]> = {};
  for (const s of subs) (byUser[s.user_id] ||= []).push(s);
  const userIds = Object.keys(byUser);

  // Pull each user's blob + their already-pushed keys.
  const [{ data: rows }, { data: profs }] = await Promise.all([
    supabase.from("folio").select("user_id, data").in("user_id", userIds),
    supabase.from("profiles").select("id, pushed_events").in("id", userIds),
  ]);
  const blobByUser: Record<string, any> = Object.fromEntries((rows || []).map(r => [r.user_id, r.data]));
  const pushedByUser: Record<string, string[]> = Object.fromEntries((profs || []).map(p => [p.id, p.pushed_events || []]));

  let sent = 0;

  for (const uid of userIds) {
    const st = blobByUser[uid]?.settings;
    if (!st) continue;

    const assets = sum(st.assets);
    const liab = sum(st.liabilities);
    const nwHistory = Array.isArray(st.nwHistory) ? st.nwHistory : [];
    const netWorth = nwHistory.length ? (nwHistory[nwHistory.length - 1].value || assets - liab) : assets - liab;
    const income = st.income || 0;
    const spendPct = st.spendPct ?? 70;
    const spendMoney = income * spendPct / 100;
    const savingsRate = income > 0 ? (income - spendMoney) / income * 100 : 0;
    const emergencyMonths = spendMoney > 0 ? assets / spendMoney : 0;

    const events = detectEvents({ netWorth, totalAssets: assets, nwHistory, goals: st.goals || [], savingsRate, emergencyMonths });
    const already = pushedByUser[uid] || [];
    const fresh = events.filter(e => !already.includes(e.key));
    if (!fresh.length) continue;

    // Push only the highest-priority new moment (detectEvents returns it first).
    const top = fresh[0];
    const payload = JSON.stringify({ title: "Folio", body: top.caption + " — tap to share", url: "/", tag: "folio-" + top.key });

    for (const s of byUser[uid]) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys as any }, payload);
        sent++;
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }

    // Mark every fresh key pushed so we don't re-offer them tomorrow.
    await supabase.from("profiles").update({ pushed_events: [...already, ...fresh.map(e => e.key)] }).eq("id", uid);
  }

  return new Response(JSON.stringify({ sent }), { headers: { "Content-Type": "application/json" } });
});
