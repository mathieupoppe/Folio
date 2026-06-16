import { useState, useEffect, useCallback } from "react";
import { C } from "./theme";
import { WATCH_ASSETS, fetchQuotes } from "./market";

// Tiny sparkline — getquin-style, colored by direction.
function Spark({ data, color, w = 70, h = 26 }) {
  if (!data || data.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...data), max = Math.max(...data), range = (max - min) || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

const card = { background: C.card, borderRadius: "16px", border: "0.5px solid " + C.border, padding: "1rem 1.1rem", marginBottom: "10px" };

export default function Watchlist({ ids, setIds, currency = "EUR" }) {
  const [quotes, setQuotes] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [errMsg, setErrMsg] = useState("");
  const [picker, setPicker] = useState(false);

  const fmtPrice = useCallback((n) => {
    if (n == null) return "—";
    const digits = n >= 1000 ? 0 : n >= 1 ? 2 : 4;
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
    } catch {
      return n.toFixed(digits);
    }
  }, [currency]);

  const load = useCallback(async (soft) => {
    if (!ids.length) { setQuotes([]); setStatus("done"); return; }
    if (!soft) setStatus("loading");
    try {
      const q = await fetchQuotes(ids, currency);
      // keep the user's order
      q.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
      setQuotes(q);
      setStatus("done");
    } catch (e) {
      setErrMsg(e?.message || "Couldn't load prices.");
      setStatus("error");
    }
  }, [ids, currency]);

  useEffect(() => { load(false); }, [load]);
  // refresh every 60s while the screen is open
  useEffect(() => {
    const t = setInterval(() => { if (document.visibilityState === "visible") load(true); }, 60000);
    return () => clearInterval(t);
  }, [load]);

  const add = (id) => { if (!ids.includes(id)) setIds([...ids, id]); setPicker(false); };
  const remove = (id) => setIds(ids.filter(x => x !== id));

  const available = WATCH_ASSETS.filter(a => !ids.includes(a.id));

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", color: C.hint }}>{status === "loading" ? "Updating…" : "Live · updates every minute"}</div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => load(false)} aria-label="Refresh" style={{ background: C.surface, border: "0.5px solid " + C.border, borderRadius: "9px", padding: "6px 10px", color: C.sub, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>↻</button>
          <button onClick={() => setPicker(p => !p)} style={{ background: C.accent, border: "none", borderRadius: "9px", padding: "6px 12px", color: C.onAccent, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>+ Add</button>
        </div>
      </div>

      {picker && (
        <div className="ffade" style={{ ...card }}>
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint, marginBottom: "8px" }}>Add to watchlist</div>
          {available.length === 0 && <div style={{ fontSize: "12px", color: C.hint, padding: "4px 0" }}>Everything's already on your list.</div>}
          {available.map(a => (
            <button key={a.id} onClick={() => add(a.id)} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", background: "none", border: "none", borderTop: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
              <span><span style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{a.name}</span> <span style={{ fontSize: "12px", color: C.hint }}>{a.symbol}</span></span>
              <span style={{ fontSize: "12px", color: C.hint }}>{a.kind} · +</span>
            </button>
          ))}
        </div>
      )}

      {status === "error" && (
        <div style={{ ...card, color: C.down, fontSize: "13px" }}>{errMsg} <button onClick={() => load(false)} style={{ marginLeft: 6, background: "none", border: "none", color: C.accent, fontWeight: 700, cursor: "pointer" }}>Retry</button></div>
      )}

      {ids.length === 0 && status !== "error" && (
        <div style={{ ...card, textAlign: "center", color: C.sub, fontSize: "13px" }}>Your watchlist is empty — tap <b style={{ color: C.text }}>+ Add</b> to follow an asset.</div>
      )}

      {/* Column header */}
      {ids.length > 0 && (
        <div style={{ display: "flex", justifyContent: "space-between", padding: "0 2px 8px", fontSize: "11px", color: C.hint }}>
          <span>Asset</span><span>Price · 24h</span>
        </div>
      )}

      <div style={card}>
        {ids.map((id, idx) => {
          const q = quotes.find(x => x.id === id);
          const asset = WATCH_ASSETS.find(a => a.id === id);
          const up = (q?.change24h ?? 0) >= 0;
          const col = up ? C.up : C.down;
          return (
            <div key={id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 0", borderTop: idx === 0 ? "none" : "0.5px solid " + C.border }}>
              {q?.image
                ? <img src={q.image} alt="" width="30" height="30" style={{ borderRadius: "50%", flexShrink: 0 }} />
                : <span style={{ width: 30, height: 30, borderRadius: "50%", background: C.surface, flexShrink: 0 }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: "14px", fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q?.name || asset?.name || id}</div>
                <div style={{ fontSize: "12px", color: C.hint }}>{q?.symbol || asset?.symbol || ""}</div>
              </div>
              {q && <div style={{ flexShrink: 0 }}><Spark data={q.spark} color={col} /></div>}
              <div style={{ textAlign: "right", flexShrink: 0, minWidth: 88 }}>
                <div className="tnum" style={{ fontSize: "14px", fontWeight: 700, color: C.text }}>{q ? fmtPrice(q.price) : "…"}</div>
                {q && <div className="tnum" style={{ fontSize: "12px", fontWeight: 600, color: col }}>{up ? "▲" : "▼"} {Math.abs(q.change24h).toFixed(2)}%</div>}
              </div>
              <button onClick={() => remove(id)} aria-label={`Remove ${asset?.name || id}`} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "13px", padding: "2px 0 2px 4px", flexShrink: 0 }}>✕</button>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: "10px", color: C.hint, textAlign: "center", lineHeight: 1.5, padding: "2px 0 6px" }}>
        Live crypto & commodity data from CoinGecko. Stocks & ETFs coming with a market-data provider.
      </div>
    </>
  );
}
