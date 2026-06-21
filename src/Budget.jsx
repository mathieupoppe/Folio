import { C } from "./theme";
import { spendByCategory } from "./lib/finance";

// Current month key, e.g. "2026-06".
export const budgetPeriod = () => new Date().toISOString().slice(0, 10).slice(0, 7);

function money(n, cur) {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); }
  catch { return Math.round(n).toString(); }
}

const card = { background: C.cardGrad, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.05rem 1.15rem", marginBottom: "12px" };

// Budget vs actual, by spending category. Budgets come straight from the Split
// planner (each bucket's % of take-home spending). Spent is derived AUTOMATICALLY
// from this month's withdrawal transactions tagged with a category — no double
// entry. Log spending once in Activity and it shows up here.
export default function BudgetTool({ spendBuckets = [], spendMoney = 0, entries = [], currency = "EUR", showHints = true, onPlan, onLog }) {
  const p = budgetPeriod();
  const spent = spendByCategory(entries, p); // { catId|"__none": amount }
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
  const uncategorized = spent.__none || 0;
  const totalRatio = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const totalCol = totalRatio > 1 ? C.down : totalRatio >= 0.9 ? C.warn : C.up;
  const monthName = new Date().toLocaleString("en-US", { month: "long" });
  const logged = totalSpent > 0 || uncategorized > 0;

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>{monthName} budget</div>
        {showHints && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>Spent is tracked automatically from your logged transactions. Resets each month.</div>}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>By category</div>
          {onLog && <button onClick={onLog} style={{ background: "none", border: "none", color: C.accent, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Log spending</button>}
        </div>
        {showHints && <div style={{ fontSize: "11px", color: C.hint, marginBottom: "8px" }}>Tag a withdrawal with a category when you log it and it counts here.</div>}
        {rows.map(r => (
          <div key={r.id} style={{ padding: "11px 0", borderTop: "0.5px solid " + C.border }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "6px" }}>
              <span style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: r.color || C.accent, flexShrink: 0 }} />
                <span style={{ fontSize: "13px", fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
              </span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: r.col, flexShrink: 0 }}>
                {money(r.sp, currency)} <span style={{ color: C.hint, fontWeight: 600 }}>/ {money(r.bud, currency)}</span>
              </span>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: C.border, overflow: "hidden" }}>
              <div style={{ height: "100%", width: Math.min(100, r.ratio * 100) + "%", background: r.col, borderRadius: "3px", transition: "width 0.2s" }} />
            </div>
          </div>
        ))}
        {uncategorized > 0 && (
          <div style={{ padding: "11px 0 0", borderTop: "0.5px solid " + C.border, display: "flex", justifyContent: "space-between", fontSize: "12px", color: C.hint }}>
            <span>Uncategorized spending</span>
            <span style={{ fontWeight: 700 }}>{money(uncategorized, currency)}</span>
          </div>
        )}
        {!logged && (
          <div style={{ padding: "12px 0 2px", borderTop: "0.5px solid " + C.border, fontSize: "12px", color: C.hint, lineHeight: 1.6 }}>
            No spending logged this month yet. Log a withdrawal and pick a category to see it tracked here.
          </div>
        )}
      </div>
    </>
  );
}
