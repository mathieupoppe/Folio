import { useState } from "react";
import { C } from "./theme";
import { debtPayoff } from "./lib/finance";

function money(n, cur) {
  if (!isFinite(n)) return "—";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(n); }
  catch { return Math.round(n).toString(); }
}
const monthsLabel = m => !isFinite(m) ? "—" : m >= 12 ? `${Math.floor(m / 12)}y ${m % 12}m` : `${m} mo`;

const card = { background: C.cardGrad, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.05rem 1.15rem", marginBottom: "12px" };
const inp = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "13px", outline: "none", color: C.text };

// Multi-debt payoff planner: snowball vs avalanche, with a comparison.
export default function DebtsTool({ debts = [], setDebts, budget, setBudget, strategy = "avalanche", setStrategy, currency = "EUR", showHints = true }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", balance: "", apr: "", min: "" });

  const add = () => {
    const balance = parseFloat(f.balance);
    if (!f.name.trim() || isNaN(balance) || balance <= 0) return;
    setDebts([...debts, { id: "d" + Date.now(), name: f.name.trim(), balance, apr: parseFloat(f.apr) || 0, min: parseFloat(f.min) || 0 }]);
    setF({ name: "", balance: "", apr: "", min: "" }); setOpen(false);
  };
  const remove = id => setDebts(debts.filter(d => d.id !== id));

  const totalBal = debts.reduce((s, d) => s + (d.balance || 0), 0);
  const minSum = debts.reduce((s, d) => s + (d.min || 0), 0);
  const bud = parseFloat(budget) || 0;

  const res = debtPayoff(debts, bud, strategy);
  const otherKey = strategy === "avalanche" ? "snowball" : "avalanche";
  const other = debtPayoff(debts, bud, otherKey);
  const saves = isFinite(res.totalInterest) && isFinite(other.totalInterest) ? other.totalInterest - res.totalInterest : 0;

  return (
    <>
      <div style={card}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>Total debt</div>
        <div className="tnum" style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em", color: totalBal > 0 ? C.down : C.up, marginTop: "6px" }}>{money(totalBal, currency)}</div>
        {showHints && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>{debts.length} debt{debts.length === 1 ? "" : "s"} · minimums {money(minSum, currency)}/mo</div>}
      </div>

      <div style={card}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint, marginBottom: "6px" }}>Your debts</div>
        {debts.map(d => (
          <div key={d.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderTop: "0.5px solid " + C.border }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{d.name}</div>
              <div style={{ fontSize: "11px", color: C.hint }}>{d.apr || 0}% APR · min {money(d.min || 0, currency)}/mo</div>
            </div>
            <div className="tnum" style={{ fontSize: "13px", fontWeight: 700, color: C.down }}>{money(d.balance, currency)}</div>
            <button onClick={() => remove(d.id)} aria-label={`Remove ${d.name}`} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "13px", padding: "2px" }}>✕</button>
          </div>
        ))}
        {debts.length === 0 && <div style={{ fontSize: "12px", color: C.hint, padding: "4px 0 8px" }}>No debts added yet.</div>}

        {open ? (
          <div className="ffade" style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
            <input placeholder="Name (e.g. Credit card)" value={f.name} onChange={e => setF({ ...f, name: e.target.value })} style={inp} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              <input type="number" placeholder={`Balance`} value={f.balance} onChange={e => setF({ ...f, balance: e.target.value })} style={inp} />
              <input type="number" placeholder="APR %" value={f.apr} onChange={e => setF({ ...f, apr: e.target.value })} style={inp} />
              <input type="number" placeholder="Min/mo" value={f.min} onChange={e => setF({ ...f, min: e.target.value })} style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <button onClick={add} style={{ padding: "11px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Add debt</button>
              <button onClick={() => { setOpen(false); setF({ name: "", balance: "", apr: "", min: "" }); }} style={{ padding: "11px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.sub, fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setOpen(true)} style={{ width: "100%", marginTop: "10px", padding: "12px", borderRadius: "11px", border: "0.5px dashed " + C.accent, background: C.accent + "14", color: C.accent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>+ Add debt</button>
        )}
      </div>

      {debts.length > 0 && (
        <>
          <div style={card}>
            <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint, marginBottom: "8px" }}>Your plan</div>
            <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Total monthly payment ({currency === "EUR" ? "€" : ""})</div>
            <input type="number" placeholder="e.g. 400" value={budget} onChange={e => setBudget(e.target.value)} style={{ ...inp, marginBottom: "12px" }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              {[["avalanche", "Avalanche", "Highest rate first — least interest"], ["snowball", "Snowball", "Smallest balance first — quick wins"]].map(([k, label, desc]) => {
                const on = strategy === k;
                return (
                  <button key={k} onClick={() => setStrategy(k)} style={{ textAlign: "left", padding: "10px 12px", borderRadius: "11px", cursor: "pointer", border: "1px solid " + (on ? C.accent : C.border), background: on ? C.accent + "18" : C.surface }}>
                    <div style={{ fontSize: "13px", fontWeight: 700, color: on ? C.accent : C.text }}>{label}</div>
                    {showHints && <div style={{ fontSize: "10.5px", color: C.hint, marginTop: "2px", lineHeight: 1.35 }}>{desc}</div>}
                  </button>
                );
              })}
            </div>
          </div>

          {!res.feasible ? (
            <div style={{ ...card, border: "0.5px solid " + C.down }}>
              <div style={{ fontSize: "13px", color: C.down, lineHeight: 1.5 }}>Your monthly payment ({money(bud, currency)}) is below your minimum payments ({money(minSum, currency)}/mo). Raise it to make a dent.</div>
            </div>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginBottom: "12px" }}>
                <Metric label="Debt-free in" value={monthsLabel(res.months)} desc="At this pace" />
                <Metric label="Total interest" value={money(res.totalInterest, currency)} desc="Cost of the debt" down />
              </div>
              {saves > 0 && (
                <div style={{ ...card, padding: "12px 14px", background: C.accent + "14", border: "0.5px solid " + C.accent + "44" }}>
                  <div style={{ fontSize: "13px", color: C.text, lineHeight: 1.5 }}>
                    <b style={{ color: C.accent }}>Avalanche</b> saves you <b>{money(saves, currency)}</b> in interest vs snowball here.
                  </div>
                </div>
              )}
              <div style={card}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint, marginBottom: "4px" }}>Payoff order</div>
                {res.payoffOrder.map((p, i) => (
                  <div key={p.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 0", borderTop: i === 0 ? "none" : "0.5px solid " + C.border }}>
                    <span style={{ fontSize: "13px", color: C.text }}><span style={{ color: C.hint }}>{i + 1}.</span> {p.name}</span>
                    <span style={{ fontSize: "12px", color: C.up, fontWeight: 600 }}>cleared {monthsLabel(p.month)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </>
  );
}

function Metric({ label, value, desc, down }) {
  return (
    <div style={{ background: C.surface, borderRadius: "12px", padding: "12px 14px", border: "0.5px solid " + C.border }}>
      <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>{label}</div>
      <div className="tnum" style={{ fontSize: "18px", fontWeight: 700, color: down ? C.down : C.text, marginBottom: "2px" }}>{value}</div>
      <div style={{ fontSize: "10px", color: C.hint }}>{desc}</div>
    </div>
  );
}
