import { useState } from "react";
import { C } from "./theme";
import { WATCH_ASSETS } from "./market";

function money(n, cur) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n);
  } catch {
    return n.toFixed(2);
  }
}

const inp = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "13px", outline: "none", color: C.text };

// Live-valued holdings: pick an asset + quantity, value = qty × live price.
// Reports nothing back itself — the parent owns `quotes` (shared price engine)
// and folds the total into net worth, so everything stays in sync automatically.
export default function HoldingsEditor({ holdings, setHoldings, quotes = [], currency = "EUR" }) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState("");

  const held = new Set(holdings.map(h => h.id));
  const available = WATCH_ASSETS.filter(a => !held.has(a.id));

  const add = () => {
    const q = parseFloat(qty);
    const a = WATCH_ASSETS.find(x => x.id === pick);
    if (!a || isNaN(q) || q <= 0) return;
    setHoldings([...holdings, { id: a.id, symbol: a.symbol, name: a.name, qty: q }]);
    setPick(""); setQty(""); setOpen(false);
  };
  const setQtyOf = (id, v) => setHoldings(holdings.map(h => h.id === id ? { ...h, qty: Math.max(0, parseFloat(v) || 0) } : h));
  const remove = id => setHoldings(holdings.filter(h => h.id !== id));

  return (
    <>
      {holdings.map(h => {
        const q = quotes.find(x => x.id === h.id);
        const val = q ? q.price * h.qty : null;
        return (
          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderTop: "0.5px solid " + C.border }}>
            {q?.image
              ? <img src={q.image} alt="" width="26" height="26" style={{ borderRadius: "50%", flexShrink: 0 }} />
              : <span style={{ width: 26, height: 26, borderRadius: "50%", background: C.surface, flexShrink: 0 }} />}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{h.symbol}</div>
              <div style={{ fontSize: "11px", color: C.hint }}>{q ? money(q.price, currency) : "loading…"} · {h.name}</div>
            </div>
            <input type="number" value={h.qty} onChange={e => setQtyOf(h.id, e.target.value)} aria-label={`${h.symbol} quantity`} min="0" step="any"
              style={{ ...inp, width: "84px", textAlign: "right", padding: "7px 9px" }} />
            <div className="tnum" style={{ fontSize: "13px", fontWeight: 700, color: C.text, minWidth: 70, textAlign: "right" }}>{money(val, currency)}</div>
            <button onClick={() => remove(h.id)} aria-label={`Remove ${h.symbol}`} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "13px", padding: "2px" }}>✕</button>
          </div>
        );
      })}
      {holdings.length === 0 && <div style={{ fontSize: "12px", color: C.hint, padding: "4px 0 8px" }}>No live holdings yet — add crypto or commodities to value them automatically.</div>}

      {open ? (
        <div className="ffade" style={{ marginTop: "10px" }}>
          <select value={pick} onChange={e => setPick(e.target.value)} aria-label="Choose asset" style={{ ...inp, marginBottom: "8px" }}>
            <option value="">Choose an asset…</option>
            {available.map(a => <option key={a.id} value={a.id}>{a.name} ({a.symbol}) · {a.kind}</option>)}
          </select>
          <input type="number" placeholder="Quantity (e.g. 0.5)" value={qty} onChange={e => setQty(e.target.value)} min="0" step="any" style={{ ...inp, marginBottom: "8px" }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <button onClick={add} style={{ padding: "11px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Add</button>
            <button onClick={() => { setOpen(false); setPick(""); setQty(""); }} style={{ padding: "11px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.sub, fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setOpen(true)} style={{ width: "100%", marginTop: "10px", padding: "12px", borderRadius: "11px", border: "0.5px dashed " + C.accent, background: C.accent + "14", color: C.accent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
          + Add holding
        </button>
      )}
    </>
  );
}
