import { C } from "./theme";

// Current month key, e.g. "2026-06".
export const budgetPeriod = () => new Date().toISOString().slice(0, 10).slice(0, 7);

function money(n, cur) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); }
  catch { return Math.round(n).toString(); }
}

const card = { background: C.cardGrad, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.05rem 1.15rem", marginBottom: "12px" };

// Budget vs actual, by spending category. Budgets come straight from the Split
// planner (each bucket's % of take-home spending), so planning and tracking stay
// in sync. Spent amounts are stored per-month and reset automatically.
export default function BudgetTool({ spendBuckets = [], spendMoney = 0, budget, setBudget, currency = "EUR", showHints = true, onPlan }) {
  const p = budgetPeriod();
  const spent = budget && budget.period === p ? (budget.spent || {}) : {};
  const setSpent = (id, v) => {
    const val = Math.max(0, parseFloat(v) || 0);
    setBudget({ period: p, spent: { ...spent, [id]: val } });
  };

  const active = spendBuckets.filter(b => (b.pct || 0) > 0);

  if (active.length === 0 || spendMoney <= 0) {
    return (
      <div style={card}>
        <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6, marginBottom: "12px" }}>
          Your budgets come from the Split planner — set your income and spending categories there first, then track them here.
        </div>
        <button onClick={onPlan} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>
          Open Split planner
        </button>
      </div>
    );
  }

  const rows = active.map(b => {
    const bud = spendMoney * (b.pct / 100);
    const sp = spent[b.id] || 0;
    const ratio = bud > 0 ? sp / bud : 0;
    const col = ratio > 1 ? C.down : ratio >= 0.9 ? C.warn : C.up;
    return { ...b, bud, sp, ratio, col };
  });
  const totalBudget = rows.reduce((s, r) => s + r.bud, 0);
  const totalSpent = rows.reduce((s, r) => s + r.sp, 0);
  const totalRatio = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const totalCol = totalRatio > 1 ? C.down : totalRatio >= 0.9 ? C.warn : C.up;
  const monthName = new Date().toLocaleString("en-US", { month: "long" });

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>{monthName} budget</div>
        {showHints && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>Spent vs your plan. Resets each month.</div>}
        <div className="tnum" style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em", color: C.text, marginTop: "8px" }}>
          {money(totalSpent, currency)} <span style={{ fontSize: "16px", color: C.hint, fontWeight: 600 }}>/ {money(totalBudget, currency)}</span>
        </div>
        <div style={{ height: "8px", borderRadius: "4px", background: C.border, overflow: "hidden", marginTop: "10px" }}>
          <div style={{ height: "100%", width: Math.min(100, totalRatio * 100) + "%", background: totalCol, borderRadius: "4px", transition: "width 0.2s" }} />
        </div>
        <div style={{ fontSize: "12px", color: C.sub, marginTop: "8px" }}>
          {totalSpent <= totalBudget
            ? <>{money(totalBudget - totalSpent, currency)} left to spend this month</>
            : <span style={{ color: C.down }}>Over budget by {money(totalSpent - totalBudget, currency)}</span>}
        </div>
      </div>

      <div style={card}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint, marginBottom: "4px" }}>By category</div>
        {showHints && <div style={{ fontSize: "11px", color: C.hint, marginBottom: "8px" }}>Tap a category's amount to log what you've spent.</div>}
        {rows.map(r => (
          <div key={r.id} style={{ padding: "11px 0", borderTop: "0.5px solid " + C.border }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.color || C.accent, flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                <span style={{ fontSize: "12px", color: C.hint }}>{currency === "EUR" ? "€" : ""}</span>
                <input type="number" value={r.sp || ""} placeholder="0" min="0" onChange={e => setSpent(r.id, e.target.value)} aria-label={`${r.label} spent`}
                  style={{ width: "72px", textAlign: "right", padding: "6px 8px", borderRadius: "8px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", fontWeight: 700, outline: "none" }} />
                <span style={{ fontSize: "12px", color: C.hint }}>/ {money(r.bud, currency)}</span>
              </span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: C.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: Math.min(100, r.ratio * 100) + "%", background: r.col, borderRadius: "3px", transition: "width 0.2s" }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
