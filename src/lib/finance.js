// Pure finance/health calculations — no React, no theme. Unit-tested in finance.test.js.

// Compound growth, one row per year. `monthly` is added at the end of each month.
export function calcGrowth(principal, monthly, years, rate) {
  const r = rate / 100 / 12;
  const rows = [];
  let bal = principal;
  for (let y = 1; y <= years; y++) {
    for (let m = 0; m < 12; m++) bal = bal * (1 + r) + monthly;
    rows.push({ year: y, balance: Math.max(0, bal) });
  }
  return rows;
}

// Detailed growth rows for the projection table — by "year" or by "month".
export function growthRows(principal, monthly, years, rate, view = "year") {
  const r = rate / 100 / 12;
  const rows = [];
  let bal = principal;
  if (view === "month") {
    for (let m = 1; m <= years * 12; m++) {
      bal = bal * (1 + r) + monthly;
      rows.push({
        key: m,
        label: `${Math.floor((m - 1) / 12) + 1}y ${((m - 1) % 12) + 1}m`,
        putIn: principal + monthly * m,
        balance: Math.max(0, bal),
      });
    }
  } else {
    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) bal = bal * (1 + r) + monthly;
      rows.push({ key: y, label: `Yr ${y}`, putIn: principal + monthly * 12 * y, balance: Math.max(0, bal) });
    }
  }
  return rows;
}

export const sumAmount = items => (items || []).reduce((s, x) => s + (x.amount || 0), 0);

// Normalize a list of subscriptions to a monthly total (yearly → /12).
export const subsMonthly = subs =>
  (subs || []).reduce((s, x) => s + (x.cycle === "yearly" ? (x.amount || 0) / 12 : (x.amount || 0)), 0);

// Financial-health score (0-100): four pillars worth 25 each. Returns numeric
// data only; the UI maps scores to colors/labels.
export function computeHealth({ spendPct, spendMoney, totalAssets, totalLiab, investBuckets }) {
  const fhSavings = Math.max(0, Math.min(25, ((100 - spendPct) / 30) * 25));
  const fhEmergency = spendMoney > 0 ? Math.max(0, Math.min(25, (totalAssets / spendMoney / 6) * 25)) : 12;
  const fhDebt = totalAssets + totalLiab > 0 ? Math.max(0, 25 * (1 - totalLiab / (totalAssets + totalLiab))) : 25;
  const fhDiv = Math.min(25, (investBuckets || []).filter(b => b.pct >= 10).length * 9);
  const score = Math.round(fhSavings + fhEmergency + fhDebt + fhDiv);
  const pillars = [
    { key: "savings",   label: "Savings rate",      score: Math.round(fhSavings),   tip: "Invest a bigger share of your income." },
    { key: "emergency", label: "Emergency cushion", score: Math.round(fhEmergency), tip: "Build assets covering ~6 months of spending." },
    { key: "debt",      label: "Low debt",          score: Math.round(fhDebt),      tip: "Lower your liabilities relative to assets." },
    { key: "div",       label: "Diversification",   score: Math.round(fhDiv),       tip: "Spread investing across a few assets." },
  ];
  return { score, pillars };
}

export const healthBandLabel = score =>
  score >= 80 ? "Excellent" : score >= 60 ? "Healthy" : score >= 40 ? "Okay" : "Needs work";

// Overall band from score + pillars. A failing *critical* pillar (the emergency
// fund) caps the label — you shouldn't read "Healthy" with almost no safety net.
// tone: "good" (green) | "watch" (amber) | "bad" (red).
export function healthBand(score, pillars = []) {
  const emergency = pillars.find(p => p.key === "emergency");
  const emergencyFailing = !!emergency && emergency.score < 10; // under ~2 months of spending

  let label, tone;
  if (score >= 80) { label = "Excellent"; tone = "good"; }
  else if (score >= 60) { label = "Healthy"; tone = "good"; }
  else if (score >= 40) { label = "Okay"; tone = "watch"; }
  else { label = "Needs work"; tone = "bad"; }

  // Can't be "good" without a safety net — cap to the in-between band.
  if (emergencyFailing && tone === "good") { label = "Okay"; tone = "watch"; }
  return { label, tone };
}

export const NW_MILESTONES = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

// Progress toward the next net-worth milestone.
export function milestoneProgress(netWorth, milestones = NW_MILESTONES) {
  const next = milestones.find(m => m > netWorth);
  const last = [...milestones].reverse().find(m => m <= netWorth) || 0;
  const pct = next ? Math.min(100, Math.max(0, ((netWorth - last) / (next - last)) * 100)) : 100;
  return { next, last, pct };
}

// Which monthly subscription charges are due so far this month but not yet
// logged. Returns [{ subId, name, amount, date, period }]. Yearly subs are
// skipped (no stored month). `entries` already-logged are matched by subId+period.
export function dueSubscriptionCharges(subs, entries, today = new Date()) {
  const y = today.getFullYear();
  const m = today.getMonth();
  const dayOfMonth = today.getDate();
  const period = `${y}-${String(m + 1).padStart(2, "0")}`;
  const logged = new Set((entries || []).filter(e => e.subId && e.period).map(e => `${e.subId}|${e.period}`));
  const out = [];
  for (const s of subs || []) {
    if (s.cycle === "yearly" || !s.day || !s.amount) continue;
    const billDay = Math.min(s.day, new Date(y, m + 1, 0).getDate()); // clamp to month length
    if (billDay > dayOfMonth) continue; // not due yet this month
    if (logged.has(`${s.id}|${period}`)) continue; // already logged
    const date = `${period}-${String(billDay).padStart(2, "0")}`;
    out.push({ subId: s.id, name: s.name, amount: s.amount, date, period });
  }
  return out;
}

// Simulate clearing debts with a fixed total monthly budget.
// debts: [{ id, name, balance, apr (annual %), min (min monthly payment) }]
// budget: total €/mo for all debts together. strategy: "avalanche" (highest APR
// first) or "snowball" (smallest balance first). Pays every minimum, then funnels
// the rest to the priority debt; freed-up minimums cascade as debts clear.
export function debtPayoff(debts, budget, strategy = "avalanche") {
  const list = (debts || [])
    .filter(d => (d.balance || 0) > 0)
    .map(d => ({ id: d.id, name: d.name, bal: d.balance, r: (d.apr || 0) / 100 / 12, min: Math.max(0, d.min || 0) }));
  if (!list.length) return { months: 0, totalInterest: 0, totalPaid: 0, payoffOrder: [], feasible: true };

  const minSum = list.reduce((s, d) => s + Math.min(d.min, d.bal), 0);
  if (budget < minSum - 0.005) return { months: Infinity, totalInterest: Infinity, totalPaid: Infinity, payoffOrder: [], feasible: false };

  const prioritize = arr => [...arr].sort(strategy === "snowball" ? (a, b) => a.bal - b.bal : (a, b) => b.r - a.r);
  let month = 0, totalInterest = 0, totalPaid = 0;
  const payoffOrder = [];
  const GUARD = 1200; // 100-year safety cap

  while (list.some(d => d.bal > 0.005) && month < GUARD) {
    month++;
    for (const d of list) if (d.bal > 0) { const i = d.bal * d.r; d.bal += i; totalInterest += i; }
    let pool = budget;
    for (const d of list) if (d.bal > 0) { const p = Math.min(d.min, d.bal, pool); d.bal -= p; pool -= p; totalPaid += p; }
    for (const d of prioritize(list)) {
      if (pool <= 0.005) break;
      if (d.bal > 0) { const p = Math.min(d.bal, pool); d.bal -= p; pool -= p; totalPaid += p; }
    }
    for (const d of list) if (d.bal <= 0.005 && !payoffOrder.find(x => x.id === d.id)) payoffOrder.push({ id: d.id, name: d.name, month });
  }
  return { months: month, totalInterest: Math.round(totalInterest), totalPaid: Math.round(totalPaid), payoffOrder, feasible: month < GUARD };
}

// Sum of withdrawal (spending) transactions in a given month, grouped by their
// category id. period is "YYYY-MM". Entries without a `cat` are grouped under
// "__none". Deposits and other months are ignored. This is what makes budget
// vs actual automatic — spend is derived from the log, never typed twice.
export function spendByCategory(entries, period) {
  const out = {};
  for (const e of entries || []) {
    if (e.type !== "withdrawal") continue;
    if (!e.date || e.date.slice(0, 7) !== period) continue;
    const key = e.cat || "__none";
    out[key] = (out[key] || 0) + (e.amount || 0);
  }
  return out;
}

// Clamp a numeric input to a sane range; returns fallback for non-numbers.
export function clampNumber(value, { min = -Infinity, max = Infinity, fallback = 0 } = {}) {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
