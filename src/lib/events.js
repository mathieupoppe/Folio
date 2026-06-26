// ─────────────────────────────────────────────────────────────────────────────
// Money-event detector — the engine behind Folio's retention loop. Pure and
// deterministic (like insights.js), it scans the user's own data and surfaces
// "moments" worth coming back for: a net-worth milestone crossed, a new monthly
// high, a goal reached, a savings streak. Each event is one-tap shareable, so
// your real progress automatically becomes feed content.
//
// Every event has a stable `key` so the app can remember which it already showed
// (see seenEvents in the synced blob) and never celebrate the same thing twice.
//
// event = { key, type, title, big, sub, trend, caption, severity }
//   big/sub/trend  → render as a feed media card (same shape as seed posts)
//   caption        → the ready-to-post text
// ─────────────────────────────────────────────────────────────────────────────

const NW_MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

const money = (n, symbol = "€") => symbol + Math.round(n).toLocaleString();
const compact = (n, symbol = "€") => {
  const a = Math.abs(n);
  if (a >= 1000000) return symbol + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "M";
  if (a >= 1000) return symbol + Math.round(n / 1000) + "k";
  return symbol + Math.round(n);
};

export function detectEvents(data = {}) {
  const {
    netWorth = 0,
    totalAssets = 0,
    nwHistory = [],          // [{ date, value }] daily snapshots, oldest→newest
    goals = [],              // [{ name, target, saved }]
    savingsRate = 0,         // percent
    emergencyMonths = 0,
    symbol = "€",
  } = data;

  const out = [];

  // 1) Net-worth milestone crossed — celebrate the highest round number passed.
  if (netWorth > 0) {
    const passed = NW_MILESTONES.filter(m => netWorth >= m);
    if (passed.length) {
      const m = passed[passed.length - 1];
      out.push({
        key: `nw-milestone-${m}`, type: "milestone", severity: "good",
        title: "Net-worth milestone", big: compact(m, symbol), sub: "net worth", trend: "up",
        caption: `Just crossed ${compact(m, symbol)} net worth 🎉 Slow and steady.`,
      });
    }
  }

  // 2) New monthly high — net worth up vs ~30 snapshots ago (and actually up).
  if (nwHistory.length >= 2) {
    const latest = nwHistory[nwHistory.length - 1];
    const past = nwHistory[Math.max(0, nwHistory.length - 31)];
    if (latest?.value > 0 && past?.value > 0 && latest.value > past.value) {
      const pct = Math.round(((latest.value - past.value) / past.value) * 100);
      if (pct >= 2) {
        const ym = (latest.date || "").slice(0, 7) || "now";
        out.push({
          key: `nw-up-${ym}`, type: "progress", severity: "good",
          title: "Net worth is climbing", big: `+${pct}%`, sub: "net worth this month", trend: "up",
          caption: `Net worth up ${pct}% this month 📈 Compounding does its thing.`,
        });
      }
    }
  }

  // 3) Strong savings rate.
  if (savingsRate >= 30) {
    const r = Math.round(savingsRate);
    out.push({
      key: `savings-strong-${Math.floor(savingsRate / 5) * 5}`, type: "milestone", severity: "good",
      title: "Elite savings rate", big: `${r}%`, sub: "of income saved", trend: "up",
      caption: `Saving ${r}% of my income right now 💪 Future me says thanks.`,
    });
  }

  // 4) Goal reached.
  for (const g of goals) {
    const saved = g.saved ?? g.current ?? 0;
    const target = g.target ?? 0;
    if (target > 0 && saved >= target && g.name) {
      out.push({
        key: `goal-done-${g.name}`, type: "milestone", severity: "good",
        title: "Goal reached", big: "✓", sub: g.name, trend: "up",
        caption: `Hit my "${g.name}" goal — ${money(target, symbol)} saved ✅`,
      });
    }
  }

  // 5) Emergency fund secured.
  if (emergencyMonths >= 6) {
    out.push({
      key: "ef-6", type: "milestone", severity: "good",
      title: "Safety net secured", big: "6+", sub: "months of expenses", trend: "up",
      caption: `6+ months of expenses saved 🛡️ Sleep-at-night money is the best money.`,
    });
  } else if (emergencyMonths >= 3) {
    out.push({
      key: "ef-3", type: "progress", severity: "good",
      title: "Emergency fund growing", big: "3", sub: "months of expenses", trend: "up",
      caption: `3 months of expenses banked 🛡️ Halfway to a full safety net.`,
    });
  }

  // 6) Tracking streak — based on how many daily snapshots exist.
  for (const n of [100, 30, 7]) {
    if (nwHistory.length >= n) {
      out.push({
        key: `streak-${n}`, type: "psychology", severity: "good",
        title: "Consistency streak", big: `${n}`, sub: "days tracking my money", trend: undefined,
        caption: `${n} days of tracking my money on Folio 🔥 Awareness is half the battle.`,
      });
      break; // only the highest streak reached
    }
  }

  return out;
}

// Convert an event into a feed post snapshot (for the in-app share sheet / zoom).
export function eventToSnap(e) {
  return {
    id: "evt-" + e.key, author: "You", handle: "@you", initial: "★",
    time: "now", tag: e.title, kind: "milestone", caption: e.caption,
    image: null, media: { big: e.big, sub: e.sub, trend: e.trend },
  };
}

export { NW_MILESTONES };
