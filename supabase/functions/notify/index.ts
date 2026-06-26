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

Deno.serve(async (req) => {
  // Only the scheduler may call this.
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("forbidden", { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  webpush.setVapidDetails(
    Deno.env.get("VAPID_SUBJECT") || "mailto:hello@folio.app",
    Deno.env.get("VAPID_PUBLIC_KEY")!,
    Deno.env.get("VAPID_PRIVATE_KEY")!,
  );

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
