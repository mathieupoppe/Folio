// Rule-based personal-finance insights — pure, deterministic, unit-tested.
// Runs instantly on-device with no network. The AI advisor (Supabase edge
// function) layers a narrative analysis on top; this is the always-available
// baseline so the coach never shows an empty screen.
//
// severity: "good" (doing well) | "watch" (keep an eye on it) | "action" (do something)

import { subsMonthly } from "./finance";

export function generateInsights(data = {}) {
  const {
    income = 0,
    spendPct = 70,
    investBuckets = [],
    assets = [],
    liabilities = [],
    subs = [],
    goals = [],
    nwHistory = [],
    symbol = "",
  } = data;

  const money = n => symbol + Math.round(n).toLocaleString();
  const out = [];
  const spendMoney = income * (spendPct / 100);
  const investable = income - spendMoney;
  const savingsRate = income > 0 ? (investable / income) * 100 : 0;
  const totalAssets = assets.reduce((s, a) => s + (a.amount || 0), 0);
  const totalLiab = liabilities.reduce((s, l) => s + (l.amount || 0), 0);
  const netWorth = totalAssets - totalLiab;
  const subCost = subsMonthly(subs);

  // Savings rate
  if (income > 0) {
    if (savingsRate >= 30)
      out.push({ id: "savings", severity: "good", title: "Strong savings rate", detail: `You're investing ${Math.round(savingsRate)}% of your income — well above the 20% many aim for. Keep it up.` });
    else if (savingsRate >= 15)
      out.push({ id: "savings", severity: "watch", title: "Decent savings rate", detail: `You're investing ${Math.round(savingsRate)}% of your income. Nudging toward 20%+ would meaningfully speed up your goals.` });
    else
      out.push({ id: "savings", severity: "action", title: "Low savings rate", detail: `Only ${Math.round(savingsRate)}% of your income is going to investing. Trimming spending even a little frees up money to grow.` });
  }

  // Emergency fund (months of spending covered by assets)
  if (spendMoney > 0) {
    const months = totalAssets / spendMoney;
    if (months >= 6)
      out.push({ id: "emergency", severity: "good", title: "Solid safety net", detail: `Your assets cover about ${months.toFixed(1)} months of spending — a healthy emergency cushion.` });
    else if (months >= 3)
      out.push({ id: "emergency", severity: "watch", title: "Emergency fund building", detail: `You have roughly ${months.toFixed(1)} months of spending saved. Aim for 6 months for full peace of mind.` });
    else
      out.push({ id: "emergency", severity: "action", title: "Thin emergency fund", detail: `Your savings cover under ${Math.max(1, Math.round(months))} month${months < 1 ? "" : "s"} of spending. Building toward 3–6 months protects you from surprises.` });
  }

  // Debt load
  if (totalLiab > 0) {
    const ratio = totalAssets > 0 ? totalLiab / totalAssets : Infinity;
    if (ratio > 1)
      out.push({ id: "debt", severity: "action", title: "Debt exceeds assets", detail: `Your liabilities (${money(totalLiab)}) are larger than your assets. Prioritising high-interest debt will improve your net worth fastest.` });
    else if (ratio > 0.5)
      out.push({ id: "debt", severity: "watch", title: "Notable debt", detail: `Debt is about ${Math.round(ratio * 100)}% of your assets. Paying it down steadily lifts your financial health score.` });
  }

  // Subscriptions
  if (subCost > 0 && income > 0) {
    const pct = (subCost / income) * 100;
    if (pct >= 10)
      out.push({ id: "subs", severity: "action", title: "Subscriptions add up", detail: `Recurring charges are ~${Math.round(pct)}% of your income (${money(subCost)}/mo). Cancelling one or two you rarely use is easy money back.` });
    else if (subCost > 0)
      out.push({ id: "subs", severity: "watch", title: "Track your subscriptions", detail: `You're spending about ${money(subCost)}/mo on subscriptions. Worth a periodic review.` });
  }

  // Diversification
  const active = investBuckets.filter(b => (b.pct || 0) > 0);
  if (active.length >= 1) {
    const top = active.reduce((m, b) => (b.pct > m.pct ? b : m), active[0]);
    if (active.length === 1)
      out.push({ id: "diversification", severity: "watch", title: "Everything in one basket", detail: `Your whole investing plan is a single asset. Spreading across a few reduces risk if one underperforms.` });
    else if (top.pct >= 80)
      out.push({ id: "diversification", severity: "watch", title: "Concentrated portfolio", detail: `${Math.round(top.pct)}% of your plan is in one asset (${top.label || "one holding"}). A little more balance lowers your risk.` });
    else
      out.push({ id: "diversification", severity: "good", title: "Nicely diversified", detail: `Your investing plan spreads across ${active.length} assets — good risk management.` });
  }

  // Goals
  const activeGoals = goals.filter(g => (g.target || 0) > 0);
  if (activeGoals.length > 0) {
    const done = activeGoals.filter(g => (g.saved || 0) >= g.target).length;
    if (done > 0)
      out.push({ id: "goals", severity: "good", title: done === 1 ? "Goal reached" : `${done} goals reached`, detail: `You've fully funded ${done} of your ${activeGoals.length} goal${activeGoals.length > 1 ? "s" : ""}. Time to set the next one?` });
    else {
      const best = activeGoals.reduce((m, g) => ((g.saved || 0) / g.target > (m.saved || 0) / m.target ? g : m), activeGoals[0]);
      const pct = Math.round(((best.saved || 0) / best.target) * 100);
      out.push({ id: "goals", severity: "watch", title: "Goals in progress", detail: `Your closest goal${best.name ? ` (${best.name})` : ""} is ${pct}% funded. Small regular top-ups keep momentum.` });
    }
  }

  // Net-worth trend
  if (nwHistory.length >= 2) {
    const first = nwHistory[0].value;
    const last = nwHistory[nwHistory.length - 1].value;
    if (last > first)
      out.push({ id: "trend", severity: "good", title: "Net worth is growing", detail: `Your net worth has risen since you started tracking. Consistency compounds — keep logging.` });
    else if (last < first)
      out.push({ id: "trend", severity: "watch", title: "Net worth has dipped", detail: `Your net worth is lower than when you started tracking. Worth checking what changed.` });
  }

  // Nothing set up yet
  if (out.length === 0) {
    out.push({ id: "start", severity: "watch", title: "Let's get a baseline", detail: "Add your income, accounts, and a goal or two — then your coach can spot opportunities and risks." });
  }

  return out;
}

// One-line headline summarizing the mix of insights.
export function insightsHeadline(insights = []) {
  const actions = insights.filter(i => i.severity === "action").length;
  const goods = insights.filter(i => i.severity === "good").length;
  if (actions === 0 && goods > 0) return "You're in good shape — a few ways to go even further.";
  if (actions >= 3) return `${actions} things worth your attention right now.`;
  if (actions > 0) return `Mostly on track, with ${actions} thing${actions > 1 ? "s" : ""} to tackle.`;
  return "Here's where you stand.";
}
