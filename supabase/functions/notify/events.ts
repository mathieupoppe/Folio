// Server-side copy of the money-event detector (mirror of src/lib/events.js).
// Kept standalone so the Deno edge function has no build step. If you change the
// rules in src/lib/events.js, mirror them here.

const NW_MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

const compact = (n: number, symbol = "€") => {
  const a = Math.abs(n);
  if (a >= 1000000) return symbol + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + "M";
  if (a >= 1000) return symbol + Math.round(n / 1000) + "k";
  return symbol + Math.round(n);
};
const money = (n: number, symbol = "€") => symbol + Math.round(n).toLocaleString();

export interface MoneyEvent { key: string; title: string; caption: string; }

export function detectEvents(data: Record<string, unknown> = {}): MoneyEvent[] {
  const {
    netWorth = 0, totalAssets = 0, nwHistory = [], goals = [],
    savingsRate = 0, emergencyMonths = 0, symbol = "€",
  } = data as {
    netWorth?: number; totalAssets?: number; nwHistory?: { date?: string; value?: number }[];
    goals?: { name?: string; target?: number; saved?: number; current?: number }[];
    savingsRate?: number; emergencyMonths?: number; symbol?: string;
  };
  const out: MoneyEvent[] = [];

  if (netWorth > 0) {
    const passed = NW_MILESTONES.filter(m => netWorth >= m);
    if (passed.length) {
      const m = passed[passed.length - 1];
      out.push({ key: `nw-milestone-${m}`, title: "Net-worth milestone", caption: `You just crossed ${compact(m, symbol)} net worth 🎉` });
    }
  }

  if (nwHistory.length >= 2) {
    const latest = nwHistory[nwHistory.length - 1];
    const past = nwHistory[Math.max(0, nwHistory.length - 31)];
    if ((latest?.value ?? 0) > 0 && (past?.value ?? 0) > 0 && (latest!.value!) > (past!.value!)) {
      const pct = Math.round((((latest!.value!) - (past!.value!)) / (past!.value!)) * 100);
      if (pct >= 2) {
        const ym = (latest!.date || "").slice(0, 7) || "now";
        out.push({ key: `nw-up-${ym}`, title: "Net worth is climbing", caption: `Your net worth is up ${pct}% this month 📈` });
      }
    }
  }

  if (savingsRate >= 30) {
    const r = Math.round(savingsRate);
    out.push({ key: `savings-strong-${Math.floor(savingsRate / 5) * 5}`, title: "Elite savings rate", caption: `You're saving ${r}% of your income right now 💪` });
  }

  for (const g of goals) {
    const saved = g.saved ?? g.current ?? 0;
    const target = g.target ?? 0;
    if (target > 0 && saved >= target && g.name) {
      out.push({ key: `goal-done-${g.name}`, title: "Goal reached", caption: `You hit your "${g.name}" goal — ${money(target, symbol)} saved ✅` });
    }
  }

  if (emergencyMonths >= 6) out.push({ key: "ef-6", title: "Safety net secured", caption: `6+ months of expenses saved 🛡️ Sleep-at-night money.` });
  else if (emergencyMonths >= 3) out.push({ key: "ef-3", title: "Emergency fund growing", caption: `3 months of expenses banked 🛡️ Halfway to a full safety net.` });

  for (const n of [100, 30, 7]) {
    if (nwHistory.length >= n) {
      out.push({ key: `streak-${n}`, title: "Consistency streak", caption: `${n} days of tracking your money on Folio 🔥` });
      break;
    }
  }

  return out;
}
