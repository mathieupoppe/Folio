import { useState, useEffect, useRef, createContext, useContext } from "react";
import { C, fmt, fmtK, curSymbol, CURRENCIES, LANGUAGES } from "./theme";
import { fetchData, saveDataSafe } from "./cloud";
import {
  calcGrowth as calcGrowthLib,
  growthRows as growthRowsLib,
  sumAmount,
  subsMonthly as subsMonthlyLib,
  computeHealth,
  healthBandLabel,
  NW_MILESTONES,
  milestoneProgress,
  dueSubscriptionCharges,
} from "./lib/finance";
import Advisor from "./Advisor";
import Watchlist from "./Watchlist";
import Feedback from "./Feedback";
import { GrowthChart, LogChart, NetWorthChart, Donut } from "./components/charts";

// When false, the small explanatory "hint" texts under section titles are hidden
// (a power-user declutter toggle). Default on — best for the average user.
const HintCtx = createContext(true);

// Default dashboard widget order (users can reorder + hide in Edit mode).
const DEFAULT_DASH = ["netWorth", "income", "stats", "health", "coach", "goals", "activity"];

const SCENARIOS = [
  { label: "Conservative", rate: 7,  desc: "Slow decade" },
  { label: "Historical",   rate: 10, desc: "S&P 500 avg" },
  { label: "Strong",       rate: 12, desc: "Bull market"  },
  { label: "Best case",    rate: 15, desc: "Exceptional"  },
];

// colored range slider — paints the filled track explicitly so it works in every browser
function rangeStyle(value, min, max, color) {
  const pct = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
  return {
    width: "100%", cursor: "pointer",
    background: `linear-gradient(to right, ${color} 0%, ${color} ${pct}%, ${C.border} ${pct}%, ${C.border} 100%)`,
    "--sl": color,
  };
}

// calcGrowth / growthRows / health / milestones live in ./lib/finance (unit-tested).

function SliderRow({ label, hint, value, min, max, step, onChange, display }) {
  const showHints = useContext(HintCtx);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const ref = useRef(null);
  const tap = () => { setDraft(String(value)); setEditing(true); setTimeout(() => ref.current?.focus(), 40); };
  const commit = () => { const n = parseFloat(draft); if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n))); setEditing(false); };
  return (
    <div style={{ marginBottom: "1.1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7px" }}>
        <div>
          <div style={{ fontSize: "13px", fontWeight: 500, color: C.text }}>{label}</div>
          {hint && showHints && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>{hint}</div>}
        </div>
        {editing
          ? <input ref={ref} type="number" value={draft} onChange={e => setDraft(e.target.value)}
              onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
              style={{ width: "90px", fontSize: "13px", fontWeight: 600, color: C.accent, background: C.surface, border: "1px solid " + C.accent, borderRadius: "6px", padding: "3px 8px", textAlign: "right", outline: "none" }} />
          : <span onClick={tap} style={{ fontSize: "13px", fontWeight: 600, color: C.accent, cursor: "pointer", borderBottom: "1px dashed " + C.accent, paddingBottom: "1px" }}>{display ?? value}</span>
        }
      </div>
      <input type="range" className="sl" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={rangeStyle(value, min, max, C.accent)} />
    </div>
  );
}

// tap-to-edit euro amount (commits the € value, caller decides what it means)
function EditableMoney({ value, onCommit, color }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const ref = useRef(null);
  const tap    = () => { setDraft(String(Math.round(value))); setEditing(true); setTimeout(() => ref.current?.focus(), 40); };
  const commit = () => { const n = parseFloat(draft); if (!isNaN(n)) onCommit(Math.max(0, n)); setEditing(false); };
  return editing
    ? <input ref={ref} type="number" value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
        style={{ width: "96px", fontSize: "13px", fontWeight: 600, color: color, background: C.surface, border: "1px solid " + color, borderRadius: "6px", padding: "3px 8px", textAlign: "right", outline: "none" }} />
    : <span onClick={tap} style={{ fontSize: "13px", fontWeight: 600, color: color, cursor: "pointer", borderBottom: "1px dashed " + color, paddingBottom: "1px" }}>{fmt(value)}</span>;
}

function Card({ children, style, className }) {
  return <div className={className} style={{ background: C.cardGrad, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.05rem 1.15rem", marginBottom: "12px", ...style }}>{children}</div>;
}

function Label({ text, hint }) {
  const showHints = useContext(HintCtx);
  return (
    <div style={{ marginBottom: "12px" }}>
      <div style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.hint }}>{text}</div>
      {hint && showHints && <div style={{ fontSize: "11px", color: C.hint, marginTop: "3px", lineHeight: 1.45 }}>{hint}</div>}
    </div>
  );
}

function Metric({ label, value, desc, positive }) {
  return (
    <div style={{ background: C.surface, borderRadius: "15px", padding: "13px 15px", border: "0.5px solid " + C.border, boxShadow: C.hi }}>
      <div style={{ fontSize: "10.5px", fontWeight: 600, letterSpacing: "0.04em", color: C.hint, marginBottom: "5px" }}>{label}</div>
      <div className="tnum" style={{ fontSize: "19px", fontWeight: 700, letterSpacing: "-0.01em", color: positive === false ? C.down : positive === true ? C.up : C.text, marginBottom: "2px" }}>{value}</div>
      {desc && <div style={{ fontSize: "10px", color: C.hint }}>{desc}</div>}
    </div>
  );
}

// ── Plan buckets ──────────────────────────────────────────────
const PALETTE = ["#5b7fff", "#3dd68c", "#f0a23c", "#c061f0", "#3cc5f0", "#f05c5c", "#e0c84a", "#7d8aff"];

// icon glyphs (feather-style, inherit currentColor)
const GLYPH = {
  etf:      <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  globe:    <><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></>,
  tech:     <><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></>,
  stocks:   <><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></>,
  dividend: <><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.5h3.5a1.75 1.75 0 0 1 0 3.5H9.5"/></>,
  bitcoin:  <><circle cx="12" cy="12" r="9"/><path d="M9.5 8h3.2a2 2 0 0 1 0 4H9.5zm0 4h3.6a2 2 0 0 1 0 4H9.5zm0-4v8m2-9v1m0 8v1"/></>,
  crypto:   <><circle cx="9" cy="9" r="6"/><path d="M16.5 7.5A6 6 0 1 1 9.6 20.4"/></>,
  bonds:    <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  gold:     <><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6"/><line x1="2" y1="9" x2="22" y2="9"/></>,
  realestate:<><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/><line x1="9" y1="9" x2="9" y2="9.01"/><line x1="9" y1="13" x2="9" y2="13.01"/></>,
  savings:  <><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 10h20"/><line x1="16" y1="14.5" x2="18" y2="14.5"/></>,
  cash:     <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/></>,
  home:     <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
  food:     <><path d="M4 2v7a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2"/><line x1="6" y1="11" x2="6" y2="22"/><path d="M17 2c-1.5 0-3 1.5-3 5v5h3"/><line x1="17" y1="2" x2="17" y2="22"/></>,
  car:      <><path d="M5 17h14M6 17l-1-5 2-5h10l2 5-1 5"/><circle cx="7.5" cy="17.5" r="1.5"/><circle cx="16.5" cy="17.5" r="1.5"/></>,
  bills:    <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  health:   <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></>,
  subs:     <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
  fun:      <><polygon points="12 2 15 9 22 9 16 14 18 21 12 17 6 21 8 14 2 9 9 9"/></>,
  goal:     <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  custom:   <><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>,
};
function Glyph({ name, size = 18 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{GLYPH[name] || GLYPH.custom}</svg>;
}
// colored circular badge holding a glyph
function IconBadge({ name, color, size = 38 }) {
  return <span style={{ width: size, height: size, borderRadius: "11px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: color + "22", color }}><Glyph name={name} size={size * 0.5} /></span>;
}

// pickable presets — investing is a rich list, spending is a simple list
const INVEST_LIBRARY = [
  { id: "vuaa",    label: "VUAA — S&P 500 ETF", hint: "The 500 biggest US companies.",   ret: 10, icon: "etf",        color: "#5b7fff" },
  { id: "iwda",    label: "IWDA — World ETF",   hint: "Developed markets worldwide.",    ret: 8,  icon: "globe",      color: "#3cc5f0" },
  { id: "emerg",   label: "Emerging markets",   hint: "Faster-growing economies.",       ret: 9,  icon: "globe",      color: "#3dd68c" },
  { id: "nasdaq",  label: "Nasdaq 100 — Tech",  hint: "US tech heavyweights.",           ret: 12, icon: "tech",       color: "#7d8aff" },
  { id: "stocks",  label: "Individual stocks",  hint: "Hand-picked companies.",          ret: 9,  icon: "stocks",     color: "#c061f0" },
  { id: "dividend",label: "Dividend stocks",    hint: "Pay you cash regularly.",         ret: 7,  icon: "dividend",   color: "#e0c84a" },
  { id: "trade",   label: "Trading",            hint: "Active learning budget.",         ret: 8,  icon: "activity",   color: "#3dd68c" },
  { id: "btc",     label: "Bitcoin",            hint: "High risk, high volatility.",     ret: 15, icon: "bitcoin",    color: "#f0a23c" },
  { id: "eth",     label: "Ethereum",           hint: "Smart-contract platform.",        ret: 16, icon: "crypto",     color: "#7d8aff" },
  { id: "crypto",  label: "Other crypto",       hint: "Altcoins. Speculative.",          ret: 18, icon: "crypto",     color: "#c061f0" },
  { id: "bonds",   label: "Bonds",              hint: "Lower risk, steady income.",      ret: 4,  icon: "bonds",      color: "#3cc5f0" },
  { id: "gold",    label: "Gold",               hint: "Inflation hedge.",                ret: 5,  icon: "gold",       color: "#e0c84a" },
  { id: "reit",    label: "Real estate / REIT", hint: "Property, without a mortgage.",   ret: 7,  icon: "realestate", color: "#f0a23c" },
  { id: "savings", label: "Savings @ 3%",       hint: "Emergency fund on Trade Republic.",ret: 3, icon: "savings",    color: "#3dd68c" },
  { id: "cash",    label: "Cash",               hint: "Dry powder, ready to deploy.",    ret: 1,  icon: "cash",       color: "#8892b0" },
];
const SPEND_LIBRARY = [
  { id: "needs",     label: "Needs",         hint: "Rent, bills, essentials.", icon: "home",  color: "#f05c5c" },
  { id: "food",      label: "Food",          hint: "Groceries & eating out.",  icon: "food",  color: "#f0a23c" },
  { id: "transport", label: "Transport",     hint: "Gas, transit, car.",       icon: "car",   color: "#3cc5f0" },
  { id: "bills",     label: "Bills",         hint: "Utilities, internet.",     icon: "bills", color: "#e0c84a" },
  { id: "health",    label: "Health",        hint: "Insurance, pharmacy, gym.",icon: "health",color: "#3dd68c" },
  { id: "subs",      label: "Subscriptions", hint: "Phone, streaming.",        icon: "subs",  color: "#7d8aff" },
  { id: "extra",     label: "Extra / Fun",   hint: "Going out, hobbies.",      icon: "fun",   color: "#c061f0" },
  { id: "emergency", label: "Emergency",     hint: "Buffer for surprises.",    icon: "goal",  color: "#5b7fff" },
];

const DEFAULT_INVEST = [
  { id: "vuaa",    label: "VUAA — S&P 500 ETF", hint: "The 500 biggest US companies.",   pct: 60, ret: 10, icon: "etf",     color: "#5b7fff" },
  { id: "trade",   label: "Trading",            hint: "Active learning budget.",         pct: 30, ret: 8,  icon: "activity",color: "#3dd68c" },
  { id: "savings", label: "Savings @ 3%",       hint: "Emergency fund. Don't touch it.", pct: 10, ret: 3,  icon: "savings", color: "#f0a23c" },
];
const DEFAULT_SPEND = [
  { id: "needs", label: "Needs",       hint: "Rent, bills, essentials.", pct: 60, icon: "home", color: "#f05c5c" },
  { id: "food",  label: "Food",        hint: "Groceries & eating out.",  pct: 25, icon: "food", color: "#f0a23c" },
  { id: "extra", label: "Extra / Fun", hint: "Going out, hobbies.",      pct: 15, icon: "fun",  color: "#c061f0" },
];

// one-tap starting points for the Split planner (reference library ids)
const PLAN_TEMPLATES = [
  { id: "balanced", name: "Balanced 50/30/20", desc: "Half needs, some fun, steady saving", spendPct: 80,
    spend: [["needs", 63], ["extra", 37]], invest: [["vuaa", 60], ["savings", 40]] },
  { id: "saver", name: "Aggressive saver", desc: "Live lean, invest hard", spendPct: 50,
    spend: [["needs", 75], ["food", 15], ["extra", 10]], invest: [["vuaa", 70], ["trade", 20], ["savings", 10]] },
  { id: "student", name: "Student", desc: "Tight budget, build the habit", spendPct: 85,
    spend: [["needs", 55], ["food", 30], ["extra", 15]], invest: [["savings", 70], ["vuaa", 30]] },
];

// color choices for individual buckets
const BUCKET_COLORS = ["#5b7fff", "#7d8aff", "#a06bff", "#c061f0", "#f0609a", "#f05c5c", "#f0a23c", "#e0c84a", "#3dd68c", "#2fbed6", "#3cc5f0", "#8892b0"];

// one editable bucket: tappable icon (recolor), label, tap-to-edit € amount (% follows), slider, remove
function BucketRow({ bucket: b, money, onPct, onColor, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState("");
  const [picking, setPicking] = useState(false);
  const ref = useRef(null);
  const amount = money * b.pct / 100;
  const tap    = () => { setDraft(String(Math.round(amount))); setEditing(true); setTimeout(() => ref.current?.focus(), 40); };
  const commit = () => { const n = parseFloat(draft); if (!isNaN(n)) onPct(money > 0 ? Math.min(100, Math.max(0, n / money * 100)) : 0); setEditing(false); };
  return (
    <div style={{ marginBottom: "1rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7px", gap: "8px" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", minWidth: 0 }}>
          <button onClick={() => setPicking(p => !p)} title="Change color" style={{ padding: 0, border: "none", background: "transparent", cursor: "pointer", borderRadius: "11px", outline: picking ? "2px solid " + b.color : "none", outlineOffset: "2px", flexShrink: 0 }}>
            <IconBadge name={b.icon || "custom"} color={b.color} size={34} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "13px", fontWeight: 500, color: C.text }}>{b.label}</div>
            {b.hint && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>{b.hint}</div>}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
          {editing
            ? <input ref={ref} type="number" value={draft} onChange={e => setDraft(e.target.value)}
                onBlur={commit} onKeyDown={e => e.key === "Enter" && commit()}
                style={{ width: "96px", fontSize: "13px", fontWeight: 600, color: C.accent, background: C.surface, border: "1px solid " + C.accent, borderRadius: "6px", padding: "3px 8px", textAlign: "right", outline: "none" }} />
            : <span onClick={tap} style={{ fontSize: "13px", fontWeight: 600, color: C.accent, cursor: "pointer", borderBottom: "1px dashed " + C.accent, whiteSpace: "nowrap" }}><span style={{ color: C.hint, fontWeight: 500 }}>{Math.round(b.pct)}% — </span>{fmt(amount)}</span>
          }
          <button onClick={onRemove} title="Remove" style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "13px", padding: "2px", lineHeight: 1 }}>✕</button>
        </div>
      </div>

      {picking && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "9px", padding: "10px 2px 12px" }}>
          {BUCKET_COLORS.map(col => (
            <button key={col} onClick={() => { onColor(col); setPicking(false); }} title={col} style={{
              width: 26, height: 26, borderRadius: "50%", cursor: "pointer", background: col,
              border: b.color === col ? "2px solid " + C.text : "2px solid transparent",
            }} />
          ))}
        </div>
      )}

      <input type="range" className="sl" min={0} max={100} step={1} value={b.pct} onChange={e => onPct(Number(e.target.value))}
        style={rangeStyle(b.pct, 0, 100, b.color)} />
    </div>
  );
}

// full-screen sheet: scrollable list of iconned assets to pick from + add-your-own
function AssetPicker({ open, onClose, title, subtitle, items, taken, onPick, onAddCustom }) {
  const [custom, setCustom] = useState("");
  if (!open) return null;
  const add = () => { const n = custom.trim(); if (!n) return; onAddCustom(n); setCustom(""); };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 520, height: "92vh", background: C.bg, borderTopLeftRadius: "22px", borderTopRightRadius: "22px", border: "0.5px solid " + C.border, borderBottom: "none", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px 14px", borderBottom: "0.5px solid " + C.border }}>
          <div style={{ width: 38, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 14px" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>{title}</div>
              {subtitle && <div style={{ fontSize: "12px", color: C.hint, marginTop: "2px" }}>{subtitle}</div>}
            </div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: "9px", border: "0.5px solid " + C.border, background: C.card, color: C.sub, cursor: "pointer", fontSize: "14px" }}>✕</button>
          </div>
        </div>

        <div style={{ overflowY: "auto", padding: "12px 14px", flex: 1 }}>
          {items.map(it => {
            const isTaken = taken.has(it.id);
            return (
              <button key={it.id} disabled={isTaken} onClick={() => onPick(it)} style={{
                width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "12px",
                borderRadius: "14px", border: "0.5px solid " + C.border, background: C.card, marginBottom: "8px",
                cursor: isTaken ? "default" : "pointer", opacity: isTaken ? 0.4 : 1, textAlign: "left",
              }}>
                <IconBadge name={it.icon} color={it.color} size={42} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: C.text }}>{it.label}</div>
                  <div style={{ fontSize: "11px", color: C.hint, marginTop: "1px" }}>{it.hint}</div>
                </div>
                {it.ret != null && <span style={{ fontSize: "11px", fontWeight: 600, color: C.sub, whiteSpace: "nowrap" }}>~{it.ret}%/yr</span>}
                <span style={{ fontSize: "16px", fontWeight: 700, color: isTaken ? C.up : C.accent, width: 18, textAlign: "center" }}>{isTaken ? "✓" : "+"}</span>
              </button>
            );
          })}
        </div>

        <div style={{ padding: "12px 14px", borderTop: "0.5px solid " + C.border, display: "flex", gap: "8px", background: C.surface }}>
          <input placeholder="Add your own…" value={custom} onChange={e => setCustom(e.target.value)}
            onKeyDown={e => e.key === "Enter" && add()}
            style={{ flex: 1, padding: "11px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.card, color: C.text, fontSize: "13px", outline: "none" }} />
          <button onClick={add} style={{ padding: "11px 18px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Add</button>
        </div>
      </div>
    </div>
  );
}

// list of buckets + total check + button that opens the full-screen picker
function BucketList({ buckets, setBuckets, library, money, addLabel, pickerTitle, pickerSubtitle }) {
  const [open, setOpen] = useState(false);
  const total = Math.round(buckets.reduce((s, b) => s + b.pct, 0));
  const taken = new Set(buckets.map(b => b.id));

  const setPct   = (id, pct) => setBuckets(buckets.map(b => b.id === id ? { ...b, pct } : b));
  const setColor = (id, color) => setBuckets(buckets.map(b => b.id === id ? { ...b, color } : b));
  const remove   = id => setBuckets(buckets.filter(b => b.id !== id));
  const addLib  = l => setBuckets([...buckets, { ...l, pct: Math.max(0, 100 - total) }]);
  const addCust = name => setBuckets([...buckets, { id: "c" + Date.now(), label: name, hint: "Custom", icon: "custom", color: PALETTE[buckets.length % PALETTE.length], pct: Math.max(0, 100 - total) }]);

  return (
    <>
      {buckets.map(b => <BucketRow key={b.id} bucket={b} money={money} onPct={p => setPct(b.id, p)} onColor={c => setColor(b.id, c)} onRemove={() => remove(b.id)} />)}
      {buckets.length === 0 && <div style={{ fontSize: "12px", color: C.hint, padding: "4px 0 10px" }}>Nothing here yet — add one below.</div>}

      <div style={{ fontSize: "12px", fontWeight: 500, color: total === 100 ? C.up : total > 100 ? C.down : C.hint, marginTop: "-2px", marginBottom: "10px" }}>
        {total === 100 ? "✓ Total: 100%" : total > 100 ? `⚠ Over by ${total - 100}% — reduce a slider` : `Total: ${total}% — ${100 - total}% left to assign`}
      </div>

      <button onClick={() => setOpen(true)} style={{ width: "100%", padding: "11px", borderRadius: "10px", border: "0.5px dashed " + C.border, background: "transparent", color: C.sub, fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "7px" }}>
        <Glyph name="custom" size={15} /> Add {addLabel}
      </button>

      <AssetPicker open={open} onClose={() => setOpen(false)} title={pickerTitle} subtitle={pickerSubtitle}
        items={library} taken={taken} onPick={addLib} onAddCustom={n => { addCust(n); setOpen(false); }} />
    </>
  );
}

// add-a-goal inputs (name + target)
function GoalAdder({ onAdd }) {
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const add = () => { const t = parseFloat(target); if (!name.trim() || !t || t <= 0) return; onAdd(name.trim(), t); setName(""); setTarget(""); };
  const inp = { padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "13px", outline: "none", color: C.text };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <input placeholder="Goal name (e.g. Emergency fund)" value={name} onChange={e => setName(e.target.value)} style={inp} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input type="number" placeholder="Target amount" value={target} onChange={e => setTarget(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} style={{ ...inp, flex: 1 }} />
        <button onClick={add} style={{ padding: "10px 18px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Add</button>
      </div>
    </div>
  );
}

// add-a-subscription inputs (name + amount + monthly/yearly + billing day)
function SubAdder({ onAdd, inputStyle }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState("monthly");
  const [day, setDay] = useState("");
  const add = () => { const a = parseFloat(amount); if (!name.trim() || !a || a <= 0) return; const d = Math.min(28, Math.max(1, parseInt(day) || 1)); onAdd(name.trim(), a, cycle, d); setName(""); setAmount(""); setDay(""); };
  return (
    <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px" }}>
      <input placeholder="Name (e.g. Netflix)" value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
      <div style={{ display: "flex", gap: "8px" }}>
        <input type="number" placeholder="Amount" value={amount} onChange={e => setAmount(e.target.value)} style={{ ...inputStyle, flex: 1 }} />
        <input type="number" placeholder="Day" title="Billing day of month" value={day} onChange={e => setDay(e.target.value)} style={{ ...inputStyle, width: "64px" }} />
        {["monthly", "yearly"].map(c => (
          <button key={c} onClick={() => setCycle(c)} style={{ padding: "0 12px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, cursor: "pointer", border: "1px solid " + (cycle === c ? C.accent : C.border), background: cycle === c ? C.accent + "18" : C.surface, color: cycle === c ? C.accent : C.sub }}>{c === "monthly" ? "mo" : "yr"}</button>
        ))}
      </div>
      <button onClick={add} style={{ padding: "11px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Add subscription</button>
    </div>
  );
}

// list of net-worth items (name + amount), with add + remove
function MoneyItemList({ items, setItems, color }) {
  const [name, setName] = useState("");
  const [amt, setAmt]   = useState("");
  const add = () => { const a = parseFloat(amt); const n = name.trim(); if (!n || isNaN(a)) return; setItems([...items, { id: "i" + Date.now(), label: n, amount: a }]); setName(""); setAmt(""); };
  const remove = (id, label) => { if (window.confirm(`Remove "${label}"?`)) setItems(items.filter(i => i.id !== id)); };
  const inp = { padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "13px", outline: "none", color: C.text };
  return (
    <>
      {items.map(it => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderTop: "0.5px solid " + C.border }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: "13px", color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</div>
          <div style={{ fontSize: "13px", fontWeight: 600, color }}>{fmt(it.amount)}</div>
          <button onClick={() => remove(it.id, it.label)} aria-label={`Remove ${it.label}`} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "13px", padding: "2px" }}>✕</button>
        </div>
      ))}
      {items.length === 0 && <div style={{ fontSize: "12px", color: C.hint, padding: "4px 0 8px" }}>Nothing added yet.</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 96px auto", gap: "8px", marginTop: "10px" }}>
        <input placeholder="Name" value={name} onChange={e => setName(e.target.value)} aria-label="Item name" style={inp} />
        <input type="number" placeholder="Amount" value={amt} onChange={e => setAmt(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} aria-label="Item amount" style={inp} />
        <button onClick={add} style={{ padding: "0 16px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Add</button>
      </div>
    </>
  );
}

// a tappable row in the More menu
function NavRow({ label, desc, onClick, danger }) {
  return (
    <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "14px 2px", background: "transparent", border: "none", borderTop: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
      <div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: danger ? C.down : C.text }}>{label}</div>
        {desc && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>{desc}</div>}
      </div>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.hint} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </button>
  );
}

// back button header for More sub-pages
function BackBar({ title, onBack }) {
  return (
    <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: "6px", background: "transparent", border: "none", color: C.sub, cursor: "pointer", padding: "2px 0 14px", fontSize: "15px", fontWeight: 700 }}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
      {title}
    </button>
  );
}

// Collapses an add/edit form behind a single button so screens feel tidy and
// "locked in". `children` can be a render-prop: (close) => JSX, so the form can
// auto-collapse after saving. `cta` is the closed-state button label.
function Reveal({ cta, children, accent }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        width: "100%", padding: "13px", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "14px",
        border: "0.5px dashed " + (accent ? C.accent : C.border),
        background: accent ? C.accent + "14" : C.surface, color: accent ? C.accent : C.text,
        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
      }}>
        <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> {cta}
      </button>
    );
  }
  const close = () => setOpen(false);
  return (
    <div className="ffade">
      {typeof children === "function" ? children(close) : children}
      <button onClick={close} style={{ width: "100%", marginTop: "8px", padding: "10px", borderRadius: "10px", border: "none", background: "transparent", color: C.hint, fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
    </div>
  );
}

// Onboarding tour — a guided spotlight walkthrough. Each step switches to the
// relevant tab and highlights the element it describes (via [data-tour="…"]).
// Auto-shows on first run; relaunchable from Settings.
const TOUR_STEPS = [
  { emoji: "👋", title: "Welcome to Folio", body: "Your money — planned, grown, and tracked in one calm place. Here's a quick guided tour.", tab: "home", target: null },
  { emoji: "📊", title: "Your net worth", body: "This card tracks everything you own minus what you owe, charted over time.", tab: "home", target: "networth" },
  { emoji: "🎛️", title: "Make it yours", body: "Tap Customize to reorder your dashboard cards or hide the ones you don't need.", tab: "home", target: "customize" },
  { emoji: "✨", title: "AI money coach", body: "Get an instant read on your finances — plus a deeper AI analysis with one tap.", tab: "home", target: "coach" },
  { emoji: "🧰", title: "Tools", body: "A split planner, growth & FIRE simulators, debt payoff and more — each explains itself as you go.", tab: "tools", target: "toolgrid" },
  { emoji: "🧾", title: "Activity", body: "Log deposits and withdrawals from here to watch your balance build over time — tap “+ Add” any time.", tab: "home", target: "recent" },
  { emoji: "⚙️", title: "Everything else", body: "Themes, currency, your stats, and this tour all live under More. You're all set!", tab: "more", target: "nav-more" },
];
function Tutorial({ onClose, onNavigate }) {
  const [i, setI] = useState(0);
  const [rect, setRect] = useState(null);
  const step = TOUR_STEPS[i];
  const last = i === TOUR_STEPS.length - 1;

  useEffect(() => {
    let cancelled = false;
    if (step.tab) onNavigate(step.tab);
    const measure = () => {
      if (cancelled) return;
      const el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    // wait for the new tab to render, scroll the target into view, then measure
    const t = setTimeout(() => {
      const el = step.target && document.querySelector(`[data-tour="${step.target}"]`);
      if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(measure, 380);
    }, 200);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => { cancelled = true; clearTimeout(t); window.removeEventListener("scroll", measure, true); window.removeEventListener("resize", measure); };
  }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const cardW = Math.min(420, vw - 24);
  const CARD_H = 300;
  let cardStyle;
  if (rect) {
    const below = vh - (rect.top + rect.height);
    const placeBelow = below > rect.top; // more room under the target than above
    const left = Math.max(12, Math.min(rect.left + rect.width / 2 - cardW / 2, vw - cardW - 12));
    const top = placeBelow
      ? Math.min(rect.top + rect.height + 14, vh - CARD_H - 12)
      : Math.max(12, rect.top - CARD_H + 40);
    cardStyle = { top: Math.max(12, top), left };
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)" };
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80 }}>
      {/* dim + click-catcher; full dim only when nothing is spotlighted */}
      <div onClick={() => {}} style={{ position: "absolute", inset: 0, background: rect ? "transparent" : "rgba(0,0,0,0.62)", backdropFilter: rect ? "none" : "blur(3px)", WebkitBackdropFilter: rect ? "none" : "blur(3px)" }} />
      {/* spotlight: the surrounding dim is the box-shadow spread */}
      {rect && (
        <div style={{ position: "fixed", top: rect.top - 6, left: rect.left - 6, width: rect.width + 12, height: rect.height + 12, borderRadius: "14px", boxShadow: `0 0 0 9999px rgba(0,0,0,0.62), 0 0 0 2px ${C.accent}, ${C.glow}`, pointerEvents: "none", transition: "all .28s cubic-bezier(.4,0,.2,1)" }} />
      )}
      <div className="ffade" style={{ position: "fixed", width: cardW, background: C.card, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow, padding: "1.2rem 1.2rem 1rem", zIndex: 82, ...cardStyle }}>
        <div style={{ display: "flex", alignItems: "center", gap: "11px", marginBottom: "10px" }}>
          <div style={{ width: 44, height: 44, borderRadius: "13px", flexShrink: 0, background: C.accent + "1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px" }}>{step.emoji}</div>
          <div style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.02em" }}>{step.title}</div>
        </div>
        <div style={{ fontSize: "13.5px", color: C.sub, lineHeight: 1.55 }}>{step.body}</div>
        <div style={{ display: "flex", gap: "6px", margin: "14px 0" }}>
          {TOUR_STEPS.map((_, idx) => (
            <span key={idx} style={{ width: idx === i ? 18 : 7, height: 7, borderRadius: "4px", background: idx === i ? C.accent : C.border, transition: "all .2s" }} />
          ))}
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {i > 0 && <button onClick={() => setI(i - 1)} style={{ flex: "0 0 auto", padding: "11px 16px", borderRadius: "11px", border: "0.5px solid " + C.border, background: C.surface, color: C.sub, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Back</button>}
          <button onClick={() => last ? onClose() : setI(i + 1)} style={{ flex: 1, padding: "11px", borderRadius: "11px", border: "none", background: C.accentGrad, boxShadow: C.glow, color: C.onAccent, fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>{last ? "Get started" : "Next"}</button>
          <span style={{ fontSize: "12px", color: C.hint, flexShrink: 0 }}>{i + 1}/{TOUR_STEPS.length}</span>
        </div>
        {!last && <button onClick={onClose} style={{ width: "100%", marginTop: "8px", padding: "6px", border: "none", background: "transparent", color: C.hint, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Skip tour</button>}
      </div>
    </div>
  );
}

// Clean feather-style line icons for each tool tile (inherit currentColor).
const TOOL_ICONS = {
  advisor:   <><path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9z"/><path d="M19 14l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z"/></>,
  watchlist: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></>,
  split:     <><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 2v10h10"/></>,
  grow:      <><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></>,
  health:    <><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></>,
  goals:     <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  savings:   <><line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></>,
  calendar:  <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  subs:      <><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>,
  debt:      <><polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/></>,
  fire:      <><path d="M12 2C9 6 7.5 8 7.5 11.5A4.5 4.5 0 0 0 12 16a4.5 4.5 0 0 0 4.5-4.5C16.5 8 15 6 12 2z"/><path d="M12 22a6 6 0 0 1-6-6"/></>,
  emergency: <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></>,
};
function ToolIcon({ name }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{TOOL_ICONS[name] || TOOL_ICONS.advisor}</svg>;
}

const ICONS = {
  split: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="12" y1="3" x2="12" y2="12"/></svg>,
  grow:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>,
  log:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>,
  net:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1"/></svg>,
  more:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/></svg>,
  home:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  tools: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
};

// Small cloud-sync status pill shown in the header.
function SyncBadge({ state, userId, onRetry }) {
  if (!userId) {
    return <span style={{ fontSize: "10px", color: C.hint }}>On this device</span>;
  }
  if (state === "error") {
    return (
      <button onClick={onRetry} style={{ display: "flex", alignItems: "center", gap: "5px", background: C.down + "18", border: "0.5px solid " + C.down, borderRadius: "20px", padding: "4px 10px", color: C.down, fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.down }} /> Not saved · Retry
      </button>
    );
  }
  const map = {
    loading: { t: "Loading…", c: C.hint },
    saving:  { t: "Saving…",  c: C.accent },
    saved:   { t: "Saved",    c: C.up },
    idle:    { t: "",         c: C.hint },
  };
  const s = map[state] || map.idle;
  if (!s.t) return <span />;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: s.c, fontWeight: 600 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.c }} /> {s.t}
    </span>
  );
}

const LOCAL_KEY = "folio-data";

// read the local cache once (instant paint), migrating from the old split keys if needed
function readCache() {
  try { const d = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null"); if (d) return d; } catch {}
  let settings = {}, entries = [];
  try { settings = JSON.parse(localStorage.getItem("folio-settings") || "{}"); } catch {}
  try { entries  = JSON.parse(localStorage.getItem("folio-log") || "[]"); } catch {}
  return { settings, entries };
}

// Device-local usage tracking (kept out of the cloud blob to avoid sync races).
const USAGE_KEY = "folio-usage";
function readUsage() {
  try { const u = JSON.parse(localStorage.getItem(USAGE_KEY) || "null"); if (u) return u; } catch {}
  return { seconds: 0, sessions: 0, firstDay: null, days: [] };
}
function writeUsage(u) { try { localStorage.setItem(USAGE_KEY, JSON.stringify(u)); } catch {} }
function fmtDuration(sec) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  if (h >= 1) return `${h}h ${m}m`;
  if (m >= 1) return `${m}m`;
  return `${Math.max(0, Math.round(sec))}s`;
}

// true when running as an installed/native app (Capacitor, PWA, iOS standalone) vs a browser tab
const isApp = typeof window !== "undefined" && (
  !!window.Capacitor ||
  window.navigator.standalone === true ||
  (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)
);

export default function Folio({ session, onSignOut, onDeleteAccount, theme, setTheme }) {
  const userId = session?.user?.id;
  const [deleting, setDeleting] = useState(false);
  const [tab, setTab] = useState("home");
  const [moreView, setMoreView] = useState("menu"); // sub-page within the More tab
  const [toolView, setToolView] = useState("menu"); // sub-page within the Tools tab
  const [homeView, setHomeView] = useState("dash"); // sub-page within the Home tab
  const [nwPeriod, setNwPeriod] = useState("MAX");    // net-worth graph period

  // local cache once, before first render
  const cache = useRef(null);
  if (cache.current === null) cache.current = readCache();

  // usage tracking — count this session once, then tick up time while visible
  const usage = useRef(null);
  if (usage.current === null) {
    const u = readUsage();
    const today = new Date().toISOString().slice(0, 10);
    u.sessions = (u.sessions || 0) + 1;
    if (!u.firstDay) u.firstDay = today;
    if (!Array.isArray(u.days)) u.days = [];
    if (!u.days.includes(today)) u.days.push(today);
    writeUsage(u);
    usage.current = u;
  }
  useEffect(() => {
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const u = usage.current;
      u.seconds = (u.seconds || 0) + 15;
      const today = new Date().toISOString().slice(0, 10);
      if (!u.days.includes(today)) u.days.push(today);
      writeUsage(u);
    }, 15000);
    return () => clearInterval(id);
  }, []);
  const s0 = cache.current.settings || {};
  const e0 = cache.current.entries  || [];

  // split
  const [income,   setIncome]   = useState(s0.income   ?? 2000);
  const [spendPct, setSpendPct] = useState(s0.spendPct ?? 70);
  const [investBuckets, setInvestBuckets] = useState(s0.investBuckets ?? DEFAULT_INVEST);
  const [spendBuckets,  setSpendBuckets]  = useState(s0.spendBuckets  ?? DEFAULT_SPEND);

  // grow
  const [principal, setPrincipal] = useState(s0.principal ?? 1000);
  const [monthly,   setMonthly]   = useState(s0.monthly   ?? 200);
  const [years,     setYears]     = useState(s0.years     ?? 15);
  const [rate,      setRate]      = useState(s0.rate      ?? 10);

  // net worth
  const [assets,      setAssets]      = useState(s0.assets      ?? []);
  const [liabilities, setLiabilities] = useState(s0.liabilities ?? []);
  const [nwHistory,   setNwHistory]   = useState(s0.nwHistory   ?? []); // [{date, value}] daily snapshots
  const [goals,       setGoals]       = useState(s0.goals       ?? []); // [{id, name, target, saved}]
  const [subs,        setSubs]        = useState(s0.subs        ?? []); // [{id, name, amount, cycle}]
  const [watchlist,   setWatchlist]   = useState(s0.watchlist   ?? ["bitcoin", "ethereum", "pax-gold"]); // CoinGecko ids

  // profile (name)
  const [profile, setProfile] = useState(s0.profile ?? { first: "", last: "" });

  // dashboard layout: widget order + hidden set (persisted), plus transient edit mode
  const [dashOrder,  setDashOrder]  = useState(s0.dashOrder  ?? DEFAULT_DASH);
  const [dashHidden, setDashHidden] = useState(s0.dashHidden ?? []);
  const [dashEdit,   setDashEdit]   = useState(false);
  const [logAddOpen, setLogAddOpen] = useState(false); // activity sub-page: add-transaction form open

  // subscription tracking: when on, due charges surface on the dashboard + calendar
  const [subTracking, setSubTracking] = useState(s0.subTracking !== false);

  // onboarding tour — auto-show on first run, relaunchable from Settings
  const [showTour, setShowTour] = useState(() => { try { return !localStorage.getItem("folio-tour-done"); } catch { return false; } });
  const closeTour = () => { try { localStorage.setItem("folio-tour-done", "1"); } catch {} setShowTour(false); };

  // milestones view: "year" | "month"
  const [msView, setMsView] = useState("year");

  // log
  const [entries,   setEntries]   = useState(e0);
  const [logDate,   setLogDate]   = useState(new Date().toISOString().slice(0,10));
  const [logType,   setLogType]   = useState("deposit");
  const [logAmount, setLogAmount] = useState("");
  const [logNote,   setLogNote]   = useState("");
  const persist = e => setEntries(e);

  // apply a full data blob to every piece of state
  const applyData = d => {
    const st = d.settings || {};
    if (st.income    != null) setIncome(st.income);
    if (st.spendPct  != null) setSpendPct(st.spendPct);
    if (Array.isArray(st.investBuckets)) setInvestBuckets(st.investBuckets);
    if (Array.isArray(st.spendBuckets))  setSpendBuckets(st.spendBuckets);
    if (st.principal != null) setPrincipal(st.principal);
    if (st.monthly   != null) setMonthly(st.monthly);
    if (st.years     != null) setYears(st.years);
    if (st.rate      != null) setRate(st.rate);
    if (Array.isArray(st.assets))      setAssets(st.assets);
    if (Array.isArray(st.liabilities)) setLiabilities(st.liabilities);
    if (Array.isArray(st.nwHistory))   setNwHistory(st.nwHistory);
    if (Array.isArray(st.goals))       setGoals(st.goals);
    if (Array.isArray(st.subs))        setSubs(st.subs);
    if (Array.isArray(st.dashOrder))   setDashOrder(st.dashOrder);
    if (Array.isArray(st.dashHidden))  setDashHidden(st.dashHidden);
    if (Array.isArray(st.watchlist))   setWatchlist(st.watchlist);
    if (typeof st.subTracking === "boolean") setSubTracking(st.subTracking);
    if (st.profile)  setProfile(st.profile);
    if (Array.isArray(d.entries)) setEntries(d.entries);
  };

  // hydrate from the user's cloud row on login (cloud wins)
  const hydrated = useRef(false);
  const lastSyncedAt = useRef(null); // server updated_at we last saw, for conflict checks
  const [sync, setSync] = useState("idle"); // idle | loading | saving | saved | error
  const [retryNonce, setRetryNonce] = useState(0); // bump to force a re-save after an error
  useEffect(() => {
    if (!userId) { hydrated.current = true; return; }
    let cancelled = false;
    setSync("loading");
    fetchData(userId).then(({ data, updatedAt }) => {
      if (cancelled) return;
      if (data) applyData(data);
      lastSyncedAt.current = updatedAt;
      hydrated.current = true;
      setSync("saved");
    }).catch(() => { hydrated.current = true; setSync("error"); });
    return () => { cancelled = true; };
  }, [userId]);

  // local cache always; debounced, conflict-aware cloud save once hydrated
  useEffect(() => {
    const blob = { settings: { income, spendPct, investBuckets, spendBuckets, principal, monthly, years, rate, assets, liabilities, nwHistory, goals, subs, profile, dashOrder, dashHidden, subTracking, watchlist }, entries };
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(blob)); }
    catch (e) { console.warn("Folio: couldn't save to local storage —", e?.message || e); }
    if (!hydrated.current || !userId) return;
    setSync("saving");
    const t = setTimeout(() => {
      saveDataSafe(userId, blob, lastSyncedAt.current).then(res => {
        if (res.conflict) {
          // Another device saved newer data — pull it in rather than overwrite.
          fetchData(userId).then(({ data, updatedAt }) => {
            if (data) applyData(data);
            lastSyncedAt.current = updatedAt;
            setSync("saved");
          }).catch(() => setSync("error"));
        } else {
          lastSyncedAt.current = res.updatedAt;
          setSync("saved");
        }
      }).catch(() => setSync("error"));
    }, 800);
    return () => clearTimeout(t);
  }, [income, spendPct, investBuckets, spendBuckets, principal, monthly, years, rate, assets, liabilities, nwHistory, goals, subs, profile, dashOrder, dashHidden, subTracking, watchlist, entries, userId, retryNonce]);

  const addEntry = () => {
    const amt = parseFloat(logAmount);
    if (!amt || amt <= 0) return;
    persist([{ id: Date.now(), date: logDate, type: logType, amount: amt, note: logNote.trim() }, ...entries].sort((a,b) => b.date.localeCompare(a.date)));
    setLogAmount(""); setLogNote("");
  };

  // recurring subscription charges due this month, not yet logged
  const dueCharges = dueSubscriptionCharges(subs, entries, new Date());
  const logDueCharges = () => {
    const newEntries = dueCharges.map((c, i) => ({
      id: Date.now() + i, date: c.date, type: "withdrawal", amount: c.amount,
      note: `${c.name} (subscription)`, subId: c.subId, period: c.period,
    }));
    persist([...newEntries, ...entries].sort((a, b) => b.date.localeCompare(a.date)));
  };

  // apply a Split planner template
  const applyTemplate = t => {
    setSpendPct(t.spendPct);
    const build = (lib, entries) => entries.map(([id, pct], i) => {
      const item = lib.find(l => l.id === id);
      return item ? { ...item, pct } : { id, label: id, pct, icon: "custom", color: PALETTE[i % PALETTE.length] };
    });
    setSpendBuckets(build(SPEND_LIBRARY, t.spend));
    setInvestBuckets(build(INVEST_LIBRARY, t.invest));
  };

  // monthly subscriptions total (normalize yearly → monthly)
  const subsMonthly = subsMonthlyLib(subs);

  // debt payoff calculator inputs
  const [debtPay, setDebtPay] = useState("");
  const [debtRate, setDebtRate] = useState("");
  // emergency fund + FIRE inputs
  const [emMonths, setEmMonths] = useState(6);
  const [emSaved, setEmSaved] = useState("");
  const [fireRate, setFireRate] = useState(4);

  // export / import — full backup of settings + log
  const fileRef = useRef(null);
  const exportData = () => {
    const data = {
      app: "folio", version: "0.5", exported: new Date().toISOString(),
      settings: { income, spendPct, investBuckets, spendBuckets, principal, monthly, years, rate, assets, liabilities, nwHistory, goals, subs, profile },
      entries,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `folio-backup-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importData = ev => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    if ((entries.length || income !== 2000) &&
        !window.confirm("Importing replaces your current settings and log. Continue?")) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const d = JSON.parse(reader.result);
        if (!d || (!d.settings && !Array.isArray(d.entries))) throw new Error("not a backup");
        applyData(d); // restores every field, including assets/liabilities/goals/subs/profile
      } catch {
        alert("Couldn't read that file — make sure it's a Folio backup.");
      }
    };
    reader.readAsText(file);
  };

  // calcs
  const investable = income * (1 - spendPct / 100);
  const spendMoney = income * spendPct / 100;
  // blended expected return across investing buckets, weighted by allocation
  const invPctTotal = investBuckets.reduce((s, b) => s + b.pct, 0);
  const blendedRet  = invPctTotal > 0
    ? investBuckets.reduce((s, b) => s + b.pct * (b.ret ?? 0), 0) / invPctTotal
    : 0;

  const growData  = calcGrowthLib(principal, monthly, years, rate);
  const final     = growData[growData.length - 1]?.balance || 0;
  const totalIn   = principal + monthly * 12 * years;
  const gains     = final - totalIn;
  // milestone rows — either one per year, or one per month (computed in ./lib/finance)
  const msRows = growthRowsLib(principal, monthly, years, rate, msView);

  const totalDep  = entries.filter(e => e.type === "deposit").reduce((s,e) => s + e.amount, 0);
  const totalWith = entries.filter(e => e.type === "withdrawal").reduce((s,e) => s + e.amount, 0);

  const totalAssets = sumAmount(assets);
  const totalLiab   = sumAmount(liabilities);
  const netWorth    = totalAssets - totalLiab;

  // financial health score (0-100): four pillars of 25 — computed in ./lib/finance
  const { score: healthScore, pillars: healthPillars } = computeHealth({ spendPct, spendMoney, totalAssets, totalLiab, investBuckets });
  const healthBand = healthScore >= 80 ? { c: C.up, t: "Excellent" } : healthScore >= 60 ? { c: C.up, t: "Healthy" } : healthScore >= 40 ? { c: C.accent, t: healthBandLabel(healthScore) } : { c: C.down, t: healthBandLabel(healthScore) };

  // net worth milestones
  const { next: nextMilestone, last: lastMilestone, pct: milestonePct } = milestoneProgress(netWorth, NW_MILESTONES);

  // compact snapshot fed to the AI coach + on-device insights (the user's own data)
  const advisorData = {
    currency: theme?.currency || "EUR",
    symbol: curSymbol(),
    income, spendPct, investBuckets, spendBuckets,
    assets, liabilities, goals, subs,
    totalAssets, totalLiab, netWorth, healthScore,
    nwHistory: nwHistory.slice(-30),
    transactions: entries.length,
  };

  // record one net-worth snapshot per day so the Home graph can show growth over time
  useEffect(() => {
    if (!hydrated.current) return;
    const today = new Date().toISOString().slice(0, 10);
    setNwHistory(prev => {
      const last = prev[prev.length - 1];
      if (last && last.date === today) {
        if (last.value === netWorth) return prev;
        const copy = prev.slice(); copy[copy.length - 1] = { date: today, value: netWorth }; return copy;
      }
      return [...prev, { date: today, value: netWorth }];
    });
  }, [netWorth]);

  const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "13px", outline: "none", color: C.text };

  // helper-text visibility (default on)
  const showHints = theme?.showHints !== false;

  return (
    <HintCtx.Provider value={showHints}>
    <div style={{ minHeight: "100vh", background: C.bg, backgroundImage: C.bgGlow, backgroundAttachment: "fixed", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: C.text }}>
      <style>{`
        * { box-sizing: border-box; }
        body{ -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; text-rendering:optimizeLegibility; font-feature-settings:"cv11" 1,"ss01" 1; }
        ::placeholder{ color:${C.hint}; }
        input,select{ color:${C.text}; }
        /* tabular, slightly tightened figures for money + stats */
        .tnum{ font-variant-numeric: tabular-nums; font-feature-settings:"tnum" 1,"ss01" 1; }
        /* every button gets a tactile press + smooth feel */
        button{ transition: transform .12s ease, box-shadow .2s ease, filter .18s ease, background .18s ease, color .18s ease; -webkit-tap-highlight-color:transparent; }
        button:active{ transform: translateY(1px) scale(0.995); }
        button:focus-visible{ outline:2px solid ${C.accent}; outline-offset:2px; }
        a:focus-visible, input:focus-visible{ outline:2px solid ${C.accent}; outline-offset:2px; }
        input[type=range].sl{ -webkit-appearance:none; appearance:none; height:6px; border-radius:3px; outline:none; padding:0; }
        input[type=range].sl::-webkit-slider-runnable-track{ height:6px; border-radius:3px; background:transparent; }
        input[type=range].sl::-webkit-slider-thumb{ -webkit-appearance:none; appearance:none; width:17px; height:17px; border-radius:50%; background:var(--sl); border:2px solid ${C.card}; box-shadow:0 2px 6px -1px rgba(0,0,0,0.4); cursor:pointer; margin-top:-5.5px; }
        input[type=range].sl::-moz-range-track{ height:6px; border-radius:3px; background:transparent; }
        input[type=range].sl::-moz-range-thumb{ width:15px; height:15px; border-radius:50%; background:var(--sl); border:2px solid ${C.card}; box-shadow:0 2px 6px -1px rgba(0,0,0,0.4); cursor:pointer; }
        ::-webkit-scrollbar{ width:11px; height:11px; }
        ::-webkit-scrollbar-thumb{ background:${C.border}; border-radius:8px; border:3px solid transparent; background-clip:content-box; }
        ::-webkit-scrollbar-thumb:hover{ background:${C.hint}; background-clip:content-box; }
        ::-webkit-scrollbar-track{ background:transparent; }
        @keyframes folioBar{ 0%{ left:-40%; } 100%{ left:100%; } }
        @keyframes folioFade{ from{ opacity:0; transform:translateY(6px); } to{ opacity:1; transform:none; } }
        .ffade{ animation: folioFade .35s ease both; }
        @keyframes folioSpin{ to{ transform: rotate(360deg); } }
        .fspin{ animation: folioSpin .8s linear infinite; }
        /* Always reserve the scrollbar so navigating between short/tall pages
           never shifts the centered content sideways. */
        html{ overflow-y: scroll; }
        /* One consistent content width on EVERY page (home → more). */
        .shell{ width:100%; margin:0 auto; max-width:600px; }
        /* Dashboard + tools menu: single column on phones, two columns on desktop. */
        .dash{ display:flex; flex-direction:column; }
        .toolgrid{ display:flex; flex-direction:column; }
        @media (min-width: 760px){
          .shell{ max-width:760px; }
          .dash{ display:grid; grid-template-columns: 1fr 1fr; gap:14px; align-items:start; }
          .dash > *{ margin-bottom:0 !important; }
          .dash .span2{ grid-column: 1 / -1; }
          .toolgrid{ display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
          .toolgrid > *{ margin-bottom:0 !important; }
        }
        @media (prefers-reduced-motion: reduce){ *{ animation:none !important; transition:none !important; } }
      `}</style>

      {/* Loading bar while pulling the latest data from the cloud */}
      {sync === "loading" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: "3px", background: C.accent + "22", zIndex: 50, overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, height: "100%", width: "40%", background: C.accent, borderRadius: "3px", animation: "folioBar 1s ease-in-out infinite" }} />
        </div>
      )}

      {/* Header */}
      <div className="shell" style={{ padding: isApp ? "calc(env(safe-area-inset-top) + 0.7rem) 1rem 0" : "1.4rem 1rem 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          {!isApp ? (
            <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
              <div style={{ width: 36, height: 36, borderRadius: "12px", background: C.accentGrad, boxShadow: C.glow + ", " + C.hi, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={C.onAccent} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
              </div>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.03em", color: C.text }}>Folio</div>
                <div style={{ fontSize: "11px", color: C.hint }}>Your personal finance tool</div>
              </div>
            </div>
          ) : <span />}
          <SyncBadge state={sync} userId={userId} onRetry={() => setRetryNonce(n => n + 1)} />
        </div>
      </div>

      {/* Pages */}
      <div className="shell" style={{ padding: "0.8rem 1rem 5rem" }}>

        {/* ── HOME ── */}
        {tab === "home" && homeView === "dash" && (() => {
          const W = {
            netWorth: (
              <Card className="span2">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.hint }}>Net worth</div>
                    <div className="tnum" style={{ fontSize: "38px", fontWeight: 800, letterSpacing: "-0.035em", color: netWorth >= 0 ? C.text : C.down, marginTop: "5px", lineHeight: 1.05 }}>{fmt(netWorth)}</div>
                  </div>
                  <button onClick={() => setHomeView("networth")} style={{ background: C.accent + "16", border: "0.5px solid " + C.accent + "3a", borderRadius: "10px", padding: "7px 13px", color: C.accent, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Manage</button>
                </div>
                <div style={{ marginTop: "10px" }}>
                  <NetWorthChart history={nwHistory} period={nwPeriod} current={netWorth} />
                </div>
                {assets.length === 0 && liabilities.length === 0 && (
                  <button onClick={() => setHomeView("networth")} style={{ width: "100%", marginTop: "10px", padding: "10px", borderRadius: "10px", border: "0.5px dashed " + C.border, background: "transparent", color: C.sub, fontSize: "12px", cursor: "pointer", textAlign: "left" }}>
                    💡 Your net worth is €0 because no accounts are added yet. Tap <span style={{ color: C.accent, fontWeight: 600 }}>Manage</span> to add what you own and owe.
                  </button>
                )}
                <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                  {[["1D","1D"],["1W","1W"],["1M","1M"],["1Y","1Y"],["MAX","Max"]].map(([val, lbl]) => {
                    const on = nwPeriod === val;
                    return <button key={val} onClick={() => setNwPeriod(val)} style={{ flex: 1, padding: "6px 4px", borderRadius: "8px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: on ? 700 : 500, background: on ? C.accent : C.surface, color: on ? C.onAccent : C.sub }}>{lbl}</button>;
                  })}
                </div>
              </Card>
            ),
            income: (
              <Card>
                <Label text="Monthly income" hint="Your take-home pay after taxes." />
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "26px", fontWeight: 700, color: C.hint }}>{curSymbol()}</span>
                  <input type="number" value={income} onChange={e => setIncome(Math.max(0, +e.target.value))}
                    aria-label="Monthly income after taxes" min="0"
                    style={{ fontSize: "26px", fontWeight: 700, background: "transparent", border: "none", outline: "none", color: C.text, width: "100%" }} />
                </div>
              </Card>
            ),
            stats: (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "8px", marginBottom: "10px" }}>
                <Metric label="Investing / mo" value={fmt(investable)} desc="From your plan" positive={true} />
                <Metric label="Avg. return"    value={blendedRet.toFixed(1) + "%"} desc="Blended" positive={true} />
                <Metric label="Net invested"   value={fmtK(totalDep - totalWith)} desc="Logged so far" positive={true} />
                <Metric label="Assets"         value={fmtK(totalAssets)} desc="Everything you own" positive={true} />
              </div>
            ),
            health: (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>Financial health</div>
                  <button onClick={() => { setTab("tools"); setToolView("health"); }} style={{ background: "none", border: "none", color: C.accent, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Details →</button>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "26px", fontWeight: 800, color: healthBand.c, letterSpacing: "-0.02em" }}>{healthScore}</span>
                  <span style={{ fontSize: "13px", color: C.sub }}>/ 100 · <span style={{ color: healthBand.c, fontWeight: 600 }}>{healthBand.t}</span></span>
                </div>
                <div style={{ height: "7px", borderRadius: "4px", background: C.border, overflow: "hidden", marginTop: "8px" }}>
                  <div style={{ height: "100%", width: healthScore + "%", background: healthBand.c, borderRadius: "4px", transition: "width 0.2s" }} />
                </div>
              </Card>
            ),
            coach: (
              <button onClick={() => { setTab("tools"); setToolView("advisor"); }} style={{
                width: "100%", textAlign: "left", marginBottom: "10px", padding: "1rem 1.1rem", borderRadius: "16px", border: "0.5px solid " + C.border, cursor: "pointer",
                background: C.card, color: C.text, display: "flex", alignItems: "center", gap: "12px",
              }}>
                <span style={{ width: 38, height: 38, borderRadius: "11px", flexShrink: 0, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.onAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9z"/><path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "-0.01em" }}>Ask your money coach</div>
                  {showHints && <div style={{ fontSize: "12px", color: C.sub }}>Get a personalized read on your finances</div>}
                </div>
                <span style={{ fontSize: "18px", color: C.sub }}>→</span>
              </button>
            ),
            goals: goals.length > 0 ? (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>Goals</div>
                  <button onClick={() => { setTab("tools"); setToolView("goals"); }} style={{ background: "none", border: "none", color: C.accent, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Manage →</button>
                </div>
                {goals.slice(0, 3).map(g => {
                  const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
                  return (
                    <div key={g.id} style={{ marginBottom: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                        <span style={{ color: C.text, fontWeight: 500 }}>{g.name}</span>
                        <span style={{ color: C.sub }}>{fmt(g.saved || 0)} / {fmt(g.target)}</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "3px", background: C.border, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: pct + "%", background: pct >= 100 ? C.up : C.accent, borderRadius: "3px", transition: "width 0.2s" }} />
                      </div>
                    </div>
                  );
                })}
              </Card>
            ) : null,
            activity: (
              <Card>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", gap: "8px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>Your transactions</div>
                  <button onClick={() => { setHomeView("activity"); setLogAddOpen(false); }} style={{ background: "none", border: "none", color: C.accent, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>View all →</button>
                </div>
                {entries.length === 0
                  ? <button onClick={() => { setHomeView("activity"); setLogAddOpen(false); }} style={{ width: "100%", textAlign: "left", padding: "6px 0", background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: C.hint }}>No transactions yet — tap to add your first.</button>
                  : entries.slice(0, 3).map(e => (
                      <div key={e.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "0.5px solid " + C.border }}>
                        <div>
                          <div style={{ fontSize: "13px", fontWeight: 600, color: e.type === "deposit" ? C.up : C.down }}>{e.type === "deposit" ? "+" : "−"}{fmt(e.amount)}</div>
                          {e.note && <div style={{ fontSize: "11px", color: C.hint, marginTop: "1px" }}>{e.note}</div>}
                        </div>
                        <span style={{ fontSize: "11px", color: C.hint }}>{e.date}</span>
                      </div>
                    ))}
              </Card>
            ),
          };
          const META = { netWorth: "Net worth", income: "Monthly income", stats: "Key stats", health: "Financial health", coach: "AI coach", goals: "Goals", activity: "Recent activity" };
          const SPAN = { netWorth: true, stats: true, coach: true, activity: true };
          const fullOrder = [...dashOrder.filter(id => DEFAULT_DASH.includes(id)), ...DEFAULT_DASH.filter(id => !dashOrder.includes(id))];
          const ordered = fullOrder.filter(id => W[id]); // only widgets that currently have content
          // Reorder within the *visible* widgets so moves never skip an absent one (e.g. Goals when empty).
          const move = (id, dir) => {
            const i = ordered.indexOf(id), j = i + dir;
            if (i < 0 || j < 0 || j >= ordered.length) return;
            const next = [...ordered];
            [next[i], next[j]] = [next[j], next[i]];
            const rest = fullOrder.filter(x => !next.includes(x)); // keep absent widgets (parked at end)
            setDashOrder([...next, ...rest]);
          };
          const toggle = id => setDashHidden(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
          const ctrl = dis => ({ width: 30, height: 28, borderRadius: "8px", border: "0.5px solid " + C.border, background: C.surface, color: dis ? C.hint : C.text, fontSize: "13px", fontWeight: 700, cursor: dis ? "default" : "pointer", opacity: dis ? 0.45 : 1, flexShrink: 0 });
          return (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                {dashEdit ? <span style={{ fontSize: "12px", color: C.hint }}>Reorder or hide your widgets.</span> : <span />}
                <button data-tour="customize" onClick={() => setDashEdit(e => !e)} style={{ padding: "7px 15px", borderRadius: "10px", border: "0.5px solid " + (dashEdit ? C.accent : C.border), background: dashEdit ? C.accent : C.surface, color: dashEdit ? C.onAccent : C.sub, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{dashEdit ? "✓ Done" : "✎ Customize"}</button>
              </div>

              {subTracking && dueCharges.length > 0 && !dashEdit && (
                <Card style={{ border: "0.5px solid " + C.accent }}>
                  <Label text="Subscriptions due" hint={`${dueCharges.length} recurring charge${dueCharges.length > 1 ? "s" : ""} due this month, not yet logged.`} />
                  {dueCharges.map(c => (
                    <div key={c.subId} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "4px 0" }}>
                      <span style={{ color: C.text }}>{c.name}<span style={{ color: C.hint }}> · {c.date}</span></span>
                      <span style={{ color: C.down, fontWeight: 600 }}>−{fmt(c.amount)}</span>
                    </div>
                  ))}
                  <button onClick={logDueCharges} style={{ width: "100%", marginTop: "10px", padding: "11px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                    Log {dueCharges.length} charge{dueCharges.length > 1 ? "s" : ""}
                  </button>
                </Card>
              )}

              <div className="dash">
                {ordered.map((id, idx) => {
                  const hidden = dashHidden.includes(id);
                  if (hidden && !dashEdit) return null;
                  return (
                    <div key={id} data-tour={id === "netWorth" ? "networth" : id === "coach" ? "coach" : id === "activity" ? "recent" : undefined} className={SPAN[id] ? "span2" : ""} style={{ opacity: hidden ? 0.45 : 1 }}>
                      {dashEdit && (
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                          <span style={{ flex: 1, fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.hint, minWidth: 0 }}>{META[id]}</span>
                          <button aria-label="Move up" onClick={() => move(id, -1)} disabled={idx === 0} style={ctrl(idx === 0)}>↑</button>
                          <button aria-label="Move down" onClick={() => move(id, 1)} disabled={idx === ordered.length - 1} style={ctrl(idx === ordered.length - 1)}>↓</button>
                          <button onClick={() => toggle(id)} style={{ ...ctrl(false), width: "auto", padding: "0 12px", color: hidden ? C.accent : C.sub }}>{hidden ? "Show" : "Hide"}</button>
                        </div>
                      )}
                      {W[id]}
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}

        {/* ── HOME → NET WORTH EDITOR ── */}
        {tab === "home" && homeView === "networth" && <>
          <BackBar title="Net worth" onBack={() => setHomeView("dash")} />
          <Card>
            <Label text="Net worth" hint="Everything you own, minus everything you owe." />
            <div style={{ fontSize: "30px", fontWeight: 800, letterSpacing: "-0.02em", color: netWorth >= 0 ? C.up : C.down }}>{fmt(netWorth)}</div>
            <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "12px", color: C.sub }}>
              <span>Assets <b style={{ color: C.up }}>{fmt(totalAssets)}</b></span>
              <span>Liabilities <b style={{ color: C.down }}>{fmt(totalLiab)}</b></span>
            </div>
          </Card>
          {nextMilestone && (
            <Card>
              <Label text="Next milestone" hint={`You're on your way to ${fmtK(nextMilestone)}.`} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "6px" }}>
                <span style={{ color: C.sub }}>{fmtK(Math.max(0, netWorth))}</span>
                <span style={{ color: C.accent, fontWeight: 700 }}>{fmtK(nextMilestone)}</span>
              </div>
              <div style={{ height: "8px", borderRadius: "4px", background: C.border, overflow: "hidden" }}>
                <div style={{ height: "100%", width: milestonePct + "%", background: C.accent, borderRadius: "4px", transition: "width 0.2s" }} />
              </div>
              {lastMilestone > 0 && <div style={{ fontSize: "11px", color: C.up, marginTop: "8px" }}>🎉 Passed {fmtK(lastMilestone)}</div>}
            </Card>
          )}
          {assets.filter(a => a.amount > 0).length >= 2 && (
            <Card>
              <Label text="What you own" hint="Your assets by share." />
              <Donut segments={assets.map((a, i) => ({ label: a.name, value: a.amount || 0, color: BUCKET_COLORS[i % BUCKET_COLORS.length] }))} centerTop="assets" centerMain={fmtK(totalAssets)} />
            </Card>
          )}
          <Card>
            <Label text="Assets" hint="Cash, investments, property — anything you own." />
            <MoneyItemList items={assets} setItems={setAssets} color={C.up} />
          </Card>
          <Card>
            <Label text="Liabilities" hint="Loans, credit cards — anything you owe." />
            <MoneyItemList items={liabilities} setItems={setLiabilities} color={C.down} />
          </Card>
        </>}

        {/* ── TOOLS MENU ── */}
        {tab === "tools" && toolView === "menu" && <>
          <div className="toolgrid" data-tour="toolgrid">
            {[
              ["advisor", "AI money coach", "Personalized analysis of your finances"],
              ["watchlist", "Watchlist", "Live crypto & commodity prices"],
              ["split", "Split planner", "Plan spending & investing from your income"],
              ["grow", "Growth simulator", "See how investments compound over time"],
              ["health", "Financial health", "Your overall money score"],
              ["goals", "Goals", "Set savings targets & track progress"],
              ["savings", "Savings rate", "What % of income you keep"],
              ["calendar", "Calendar", "When your subscriptions are due"],
              ["subs", "Subscriptions", "Track recurring costs"],
              ["debt", "Debt payoff", "Estimate your debt-free date"],
              ["fire", "FIRE number", "What you need to retire"],
              ["emergency", "Emergency fund", "Months of expenses covered"],
            ].map(([id, label, desc]) => (
              <button key={id} onClick={() => setToolView(id)} style={{
                textAlign: "left", cursor: "pointer", background: C.cardGrad, border: "0.5px solid " + C.border,
                boxShadow: C.shadow + ", " + C.hi, borderRadius: "16px", padding: "14px 16px", marginBottom: "10px",
                display: "flex", alignItems: "center", gap: "12px",
              }}>
                <span style={{ width: 38, height: 38, borderRadius: "11px", flexShrink: 0, background: C.accent + "1c", color: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ToolIcon name={id} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: C.text }}>{label}</span>
                  {showHints && <span style={{ display: "block", fontSize: "12px", color: C.hint, marginTop: "2px" }}>{desc}</span>}
                </span>
                <span style={{ color: C.hint, fontSize: "16px", flexShrink: 0 }}>›</span>
              </button>
            ))}
          </div>
          <div style={{ fontSize: "11px", color: C.hint, textAlign: "center", padding: "6px 0" }}>More tools coming soon.</div>
        </>}

        {/* ── AI COACH (Tools) ── */}
        {tab === "tools" && toolView === "advisor" && <>
          <BackBar title="AI money coach" onBack={() => setToolView("menu")} />
          <Advisor data={advisorData} />
        </>}

        {/* ── WATCHLIST (Tools) ── */}
        {tab === "tools" && toolView === "watchlist" && <>
          <BackBar title="Watchlist" onBack={() => setToolView("menu")} />
          <Watchlist ids={watchlist} setIds={setWatchlist} currency={theme?.currency || "EUR"} />
        </>}

        {/* ── SPLIT (Tools) ── */}
        {tab === "tools" && toolView === "split" && <>
          <BackBar title="Split planner" onBack={() => setToolView("menu")} />
          <Reveal cta="Templates">
            {close => (
              <Card>
                <Label text="Start from a template" hint="A one-tap starting point — tweak everything after." />
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {PLAN_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { if (window.confirm(`Apply the "${t.name}" template? This replaces your current split.`)) { applyTemplate(t); close(); } }} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, cursor: "pointer", textAlign: "left" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{t.name}</div>
                        {showHints && <div style={{ fontSize: "11px", color: C.hint, marginTop: "1px" }}>{t.desc}</div>}
                      </div>
                      <span style={{ fontSize: "12px", fontWeight: 600, color: C.accent, flexShrink: 0, marginLeft: "10px" }}>Apply</span>
                    </button>
                  ))}
                </div>
              </Card>
            )}
          </Reveal>
          <Card>
            <Label text="Monthly income" hint="Your take-home pay after taxes." />
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "26px", fontWeight: 700, color: C.hint }}>{curSymbol()}</span>
              <input type="number" value={income} onChange={e => setIncome(Math.max(0, +e.target.value))}
                aria-label="Monthly income after taxes" min="0"
                style={{ fontSize: "26px", fontWeight: 700, background: "transparent", border: "none", outline: "none", color: C.text, width: "100%" }} />
            </div>
          </Card>

          <Card>
            <Label text="Spending vs investing" hint={`Tap a ${curSymbol()} amount to set it directly, or drag the slider.`} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "7px" }}>
              <div>
                <div style={{ fontSize: "13px", fontWeight: 500, color: C.text }}>Spending</div>
                <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>Rent, food, transport, going out.</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: C.hint }}>{Math.round(spendPct)}%</span>
                <EditableMoney value={income * spendPct / 100} color={C.down} onCommit={eur => setSpendPct(income > 0 ? Math.min(100, Math.max(0, eur / income * 100)) : 0)} />
              </div>
            </div>
            <input type="range" className="sl" min={0} max={100} step={1} value={spendPct} onChange={e => setSpendPct(Number(e.target.value))}
              style={rangeStyle(spendPct, 0, 100, C.accent)} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", marginTop: "6px", marginBottom: "4px" }}>
              <div style={{ color: C.sub }}>Investing <span style={{ fontSize: "10px", color: C.hint }}>(auto)</span></div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "11px", color: C.hint }}>{Math.round(100 - spendPct)}%</span>
                <EditableMoney value={investable} color={C.up} onCommit={eur => setSpendPct(income > 0 ? Math.min(100, Math.max(0, 100 - eur / income * 100)) : 0)} />
              </div>
            </div>
            <div style={{ height: "6px", borderRadius: "3px", background: C.border, overflow: "hidden", marginTop: "8px" }}>
              <div style={{ height: "100%", width: spendPct + "%", background: C.down, borderRadius: "3px", transition: "width 0.15s" }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: C.hint, marginTop: "4px" }}>
              <span style={{ color: C.down }}>Spending {Math.round(spendPct)}%</span>
              <span style={{ color: C.up }}>Investing {Math.round(100-spendPct)}%</span>
            </div>
          </Card>

          <Card>
            <Label text="Plan your spending" hint={`Split your ${fmt(spendMoney)}/mo across categories. Add what fits your life.`} />
            <BucketList buckets={spendBuckets} setBuckets={setSpendBuckets} library={SPEND_LIBRARY} money={spendMoney} addLabel="category" pickerTitle="Spending categories" pickerSubtitle="Pick where your money goes each month." />
          </Card>

          <Card>
            <Label text="Split your investing money" hint={`Divide your ${fmt(investable)}/mo across assets. Pick from the list or add your own.`} />
            <BucketList buckets={investBuckets} setBuckets={setInvestBuckets} library={INVEST_LIBRARY} money={investable} addLabel="asset" pickerTitle="Asset library" pickerSubtitle="Choose what to put your money into." />
          </Card>

          {investBuckets.some(b => b.pct > 0) && (
            <Card>
              <Label text="Your allocation" hint="How your investing money is divided." />
              <Donut segments={investBuckets.map(b => ({ label: b.label, value: b.pct, color: b.color }))} centerTop="/ month" centerMain={fmt(investable)} />
            </Card>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
            <Metric label="Spending / mo"   value={fmt(spendMoney)} desc="Day-to-day life" />
            <Metric label="Investing / mo"  value={fmt(investable)} desc="Working for you" positive={true} />
            <Metric label="Avg. return"     value={blendedRet.toFixed(1) + "%"} desc="Blended across assets" positive={true} />
            <Metric label="Invested / year" value={fmtK(investable * 12)} desc="Annual total" positive={true} />
            {investBuckets.map(b => (
              <Metric key={b.id} label={b.label + " / mo"} value={fmt(investable * b.pct / 100)} desc={b.ret != null ? `~${b.ret}%/yr` : "Custom asset"} positive={true} />
            ))}
          </div>

          <button onClick={() => { setMonthly(Math.round(investable)); setRate(Math.min(20, Math.max(1, Math.round(blendedRet * 2) / 2))); setTab("tools"); setToolView("grow"); }} style={{
            width: "100%", marginTop: "10px", padding: "13px", borderRadius: "12px", border: "none",
            background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "14px", cursor: "pointer",
            letterSpacing: "-0.01em", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
          }}>
            See {fmt(investable)}/mo grow at {blendedRet.toFixed(1)}%
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={C.onAccent} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          </button>
        </>}

        {/* ── GROW (Tools) ── */}
        {tab === "tools" && toolView === "grow" && <>
          <BackBar title="Growth simulator" onBack={() => setToolView("menu")} />
          <Card>
            <Label text="Your numbers" hint="Tap any value to type directly, or drag the slider." />
            <SliderRow label="Starting amount" hint="Money you invest on day one." value={principal} min={0} max={50000} step={100} onChange={setPrincipal} display={fmt(principal)} />
            <SliderRow label="Monthly addition" hint="Extra you add every month." value={monthly} min={0} max={2000} step={50} onChange={setMonthly} display={fmt(monthly)} />
            <SliderRow label="Years" hint="Time is your biggest advantage. The longer the better." value={years} min={1} max={60} step={1} onChange={setYears} display={years + " yrs"} />
            <SliderRow label="Annual return" hint="Drag, or pick a scenario below." value={rate} min={1} max={20} step={0.5} onChange={setRate} display={rate + "%"} />
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "-4px" }}>
              {SCENARIOS.map(s => {
                const active = Math.abs(rate - s.rate) < 0.05;
                return (
                  <button key={s.label} onClick={() => setRate(s.rate)} title={s.desc} style={{
                    padding: "6px 11px", borderRadius: "999px", cursor: "pointer", fontSize: "12px", fontWeight: 600,
                    border: "0.5px solid " + (active ? C.accent : C.border),
                    background: active ? C.accent + "1e" : C.surface, color: active ? C.accent : C.sub,
                  }}>{s.label} · {s.rate}%</button>
                );
              })}
            </div>
          </Card>

          <Card>
            <Label text="Projected growth" hint="Green line = your investment growing. Dashed = what you put in." />
            <GrowthChart data={growData} principal={principal} monthly={monthly} />
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginBottom: "10px" }}>
            <Metric label="Final value"    value={fmtK(final)}  desc={`After ${years} years`} positive={true} />
            <Metric label="You put in"     value={fmtK(totalIn)} desc="Total contributions" />
            <Metric label="Market profit"  value={fmtK(gains)}  desc="Made by compounding" positive={gains >= 0} />
            <Metric label="Multiplier"     value={totalIn > 0 ? (final/totalIn).toFixed(1)+"x" : "—"} desc={`Every ${curSymbol()}1 became this`} positive={true} />
          </div>

          <Card>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
              <Label text="Milestones" hint={msView === "month" ? "Your balance month by month." : "Your balance year by year."} />
              <div style={{ display: "flex", gap: "3px", background: C.surface, borderRadius: "9px", padding: "3px", border: "0.5px solid " + C.border, flexShrink: 0 }}>
                {[["year","Year"],["month","Month"]].map(([id, lbl]) => (
                  <button key={id} onClick={() => setMsView(id)} style={{
                    padding: "5px 12px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "12px",
                    fontWeight: msView === id ? 700 : 500,
                    background: msView === id ? C.accent : "transparent",
                    color: msView === id ? C.onAccent : C.sub,
                  }}>{lbl}</button>
                ))}
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ color: C.hint }}>
                  {[msView === "month" ? "Month" : "Year","Put in","Profit","Total"].map((h,i) => <th key={h} style={{ padding: "6px 0", fontWeight: 500, textAlign: i === 0 ? "left" : "right" }}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {msRows.map(row => {
                  const p = row.balance - row.putIn;
                  return (
                    <tr key={row.key} style={{ borderTop: "0.5px solid " + C.border }}>
                      <td style={{ padding: "8px 0", color: C.hint }}>{row.label}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", color: C.sub }}>{fmtK(row.putIn)}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", color: p >= 0 ? C.up : C.down }}>{fmtK(p)}</td>
                      <td style={{ padding: "8px 0", textAlign: "right", fontWeight: 600, color: C.accent }}>{fmtK(row.balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          <div style={{ fontSize: "10px", color: C.hint, textAlign: "center", padding: "4px 0 8px" }}>Past performance doesn't guarantee future results.</div>
        </>}

        {/* ── GOALS (Tools) ── */}
        {tab === "tools" && toolView === "goals" && <>
          <BackBar title="Goals" onBack={() => setToolView("menu")} />
          {goals.length === 0 && <div style={{ fontSize: "12px", color: C.hint, textAlign: "center", padding: "10px 0" }}>No goals yet — add your first below.</div>}
          {goals.map(g => {
            const pct = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
            const done = pct >= 100;
            return (
              <Card key={g.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                  <div style={{ fontSize: "14px", fontWeight: 700 }}>{g.name}</div>
                  <button onClick={() => { if (window.confirm(`Delete goal "${g.name}"?`)) setGoals(goals.filter(x => x.id !== g.id)); }} aria-label={`Delete goal ${g.name}`} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "13px" }}>✕</button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                  <span style={{ color: done ? C.up : C.sub }}>{fmt(g.saved)} of {fmt(g.target)}</span>
                  <span style={{ color: done ? C.up : C.accent, fontWeight: 600 }}>{Math.round(pct)}%</span>
                </div>
                <div style={{ height: "8px", borderRadius: "4px", background: C.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: pct + "%", background: done ? C.up : C.accent, borderRadius: "4px", transition: "width 0.2s" }} />
                </div>
                <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                  {[50, 100, 250].map(inc => (
                    <button key={inc} onClick={() => setGoals(goals.map(x => x.id === g.id ? { ...x, saved: Math.max(0, (x.saved || 0) + inc) } : x))} style={{ flex: 1, padding: "7px", borderRadius: "8px", border: "0.5px solid " + C.border, background: C.surface, color: C.up, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>+{fmt(inc)}</button>
                  ))}
                  <button onClick={() => setGoals(goals.map(x => x.id === g.id ? { ...x, saved: Math.max(0, (x.saved || 0) - 50) } : x))} style={{ padding: "7px 10px", borderRadius: "8px", border: "0.5px solid " + C.border, background: C.surface, color: C.hint, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>−</button>
                </div>
              </Card>
            );
          })}
          <Reveal cta="Add goal" accent>
            {close => (
              <Card>
                <Label text="New goal" hint="Name it and set a target amount." />
                <GoalAdder onAdd={(name, target) => { setGoals([...goals, { id: Date.now(), name, target, saved: 0 }]); close(); }} />
              </Card>
            )}
          </Reveal>
        </>}

        {/* ── SUBSCRIPTIONS (Tools) ── */}
        {tab === "tools" && toolView === "subs" && <>
          <BackBar title="Subscriptions" onBack={() => setToolView("menu")} />
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>Track on calendar</div>
                {showHints && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>Show due charges on your dashboard & calendar.</div>}
              </div>
              <button role="switch" aria-checked={subTracking} onClick={() => setSubTracking(v => !v)} style={{ width: 46, height: 28, borderRadius: "999px", border: "none", cursor: "pointer", flexShrink: 0, background: subTracking ? C.up : C.border, position: "relative", transition: "background .2s" }}>
                <span style={{ position: "absolute", top: 3, left: subTracking ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", transition: "left .2s" }} />
              </button>
            </div>
          </Card>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginBottom: "10px" }}>
            <Metric label="Per month" value={fmt(subsMonthly)} desc="All subscriptions" positive={false} />
            <Metric label="Per year"  value={fmtK(subsMonthly * 12)} desc="That's the yearly cost" positive={false} />
          </div>
          <Card>
            <Label text="Your subscriptions" hint="Phone, streaming, gym, software…" />
            {subs.length === 0 && <div style={{ fontSize: "12px", color: C.hint, padding: "4px 0 10px" }}>Nothing added yet.</div>}
            {subs.map(x => (
              <div key={x.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: "0.5px solid " + C.border }}>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{x.name}</div>
                  <div style={{ fontSize: "11px", color: C.hint }}>{fmt(x.amount)} / {x.cycle === "yearly" ? "year" : "month"}{x.day ? ` · day ${x.day}` : ""}</div>
                </div>
                <button onClick={() => { if (window.confirm(`Remove subscription "${x.name}"?`)) setSubs(subs.filter(s => s.id !== x.id)); }} aria-label={`Remove subscription ${x.name}`} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "13px" }}>✕</button>
              </div>
            ))}
          </Card>
          <Reveal cta="Add subscription" accent>
            {close => (
              <Card>
                <Label text="New subscription" hint="Name, amount, billing cycle and day." />
                <SubAdder inputStyle={inputStyle} onAdd={(name, amount, cycle, day) => { setSubs([...subs, { id: Date.now(), name, amount, cycle, day }]); close(); }} />
              </Card>
            )}
          </Reveal>
        </>}

        {/* ── DEBT PAYOFF (Tools) ── */}
        {tab === "tools" && toolView === "debt" && (() => {
          const bal = totalLiab;
          const pay = parseFloat(debtPay) || 0;
          const r = (parseFloat(debtRate) || 0) / 100 / 12;
          let months = 0, ok = false;
          if (bal > 0 && pay > 0) {
            if (pay > bal * r) {
              months = r > 0 ? Math.ceil(Math.log(pay / (pay - bal * r)) / Math.log(1 + r)) : Math.ceil(bal / pay);
              ok = true;
            }
          }
          const totalPaid = ok ? pay * months : 0;
          return <>
            <BackBar title="Debt payoff" onBack={() => setToolView("menu")} />
            <Card>
              <Label text="Your debt" hint="Total comes from your Liabilities in Net worth." />
              <div style={{ fontSize: "26px", fontWeight: 800, color: bal > 0 ? C.down : C.up }}>{fmt(bal)}</div>
              {bal === 0 && <div style={{ fontSize: "12px", color: C.hint, marginTop: "4px" }}>No liabilities logged — add them under Home → Manage.</div>}
            </Card>
            <Card>
              <Label text="Your plan" hint="How much you'll pay and the interest rate." />
              <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Monthly payment ({curSymbol()})</div>
              <input type="number" placeholder="e.g. 300" value={debtPay} onChange={e => setDebtPay(e.target.value)} style={{ ...inputStyle, marginBottom: "8px" }} />
              <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Interest rate (% / year)</div>
              <input type="number" placeholder="e.g. 7" value={debtRate} onChange={e => setDebtRate(e.target.value)} style={inputStyle} />
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
              <Metric label="Debt-free in" value={ok ? (months >= 12 ? `${Math.floor(months/12)}y ${months%12}m` : `${months} mo`) : "—"} desc={ok ? "At this pace" : "Raise your payment"} positive={ok} />
              <Metric label="Total paid" value={ok ? fmtK(totalPaid) : "—"} desc={ok ? `${fmtK(totalPaid - bal)} interest` : "—"} positive={false} />
            </div>
            {bal > 0 && pay > 0 && !ok && <div style={{ fontSize: "12px", color: C.down, textAlign: "center", padding: "8px 0" }}>Your payment is too low to cover the interest — increase it.</div>}
          </>;
        })()}

        {/* ── SAVINGS RATE (Tools) ── */}
        {tab === "tools" && toolView === "savings" && (() => {
          const rate = 100 - spendPct; // investing share of income
          const band = rate >= 50 ? { c: C.up, t: "Exceptional — you're building wealth fast." }
            : rate >= 20 ? { c: C.up, t: "Great — above the 20% rule of thumb." }
            : rate >= 10 ? { c: C.accent, t: "Solid start — nudge it higher when you can." }
            : { c: C.down, t: "Low — try to free up more to invest." };
          return <>
            <BackBar title="Savings rate" onBack={() => setToolView("menu")} />
            <Card>
              <Label text="Your savings rate" hint="The share of your income you invest instead of spend." />
              <div style={{ fontSize: "40px", fontWeight: 800, color: band.c, letterSpacing: "-0.02em" }}>{Math.round(rate)}%</div>
              <div style={{ height: "8px", borderRadius: "4px", background: C.border, overflow: "hidden", margin: "8px 0 6px" }}>
                <div style={{ height: "100%", width: rate + "%", background: band.c, borderRadius: "4px" }} />
              </div>
              <div style={{ fontSize: "12px", color: C.sub }}>{band.t}</div>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
              <Metric label="Investing / mo" value={fmt(investable)} desc="Out of your income" positive={true} />
              <Metric label="Per year"       value={fmtK(investable * 12)} desc="Invested annually" positive={true} />
            </div>
            <div style={{ fontSize: "11px", color: C.hint, textAlign: "center", padding: "8px 0" }}>Adjust this on the Split planner.</div>
          </>;
        })()}

        {/* ── FIRE NUMBER (Tools) ── */}
        {tab === "tools" && toolView === "fire" && (() => {
          const annualExpenses = spendMoney * 12;
          const fireNumber = fireRate > 0 ? annualExpenses / (fireRate / 100) : 0;
          // months investing `investable`/mo at blendedRet to reach fireNumber from zero
          let bal = 0, months = 0; const mr = blendedRet / 100 / 12;
          if (investable > 0 && fireNumber > 0) { while (bal < fireNumber && months < 1200) { bal = bal * (1 + mr) + investable; months++; } }
          const reachable = months > 0 && months < 1200;
          return <>
            <BackBar title="FIRE number" onBack={() => setToolView("menu")} />
            <Card>
              <Label text="Your FIRE number" hint="Invest this much and your investments can cover your spending forever." />
              <div style={{ fontSize: "32px", fontWeight: 800, color: C.accent, letterSpacing: "-0.02em" }}>{fmtK(fireNumber)}</div>
              <div style={{ fontSize: "12px", color: C.sub, marginTop: "4px" }}>Based on {fmt(annualExpenses)}/yr of spending.</div>
            </Card>
            <Card>
              <Label text="Safe withdrawal rate" hint="4% is the classic rule. Lower = safer, bigger number." />
              <SliderRow label="Withdrawal rate" value={fireRate} min={3} max={6} step={0.5} onChange={setFireRate} display={fireRate + "%"} />
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
              <Metric label="Time to reach" value={reachable ? (months >= 12 ? `${Math.floor(months/12)}y ${months%12}m` : `${months} mo`) : "—"} desc={reachable ? `at ${fmt(investable)}/mo` : "Invest more to reach it"} positive={reachable} />
              <Metric label="Blended return" value={blendedRet.toFixed(1) + "%"} desc="From your split" positive={true} />
            </div>
            <div style={{ fontSize: "10px", color: C.hint, textAlign: "center", padding: "6px 0" }}>Estimate from zero invested. A guide, not a guarantee.</div>
          </>;
        })()}

        {/* ── EMERGENCY FUND (Tools) ── */}
        {tab === "tools" && toolView === "emergency" && (() => {
          const monthlyExpenses = spendMoney;
          const target = monthlyExpenses * emMonths;
          const saved = parseFloat(emSaved) || 0;
          const covered = monthlyExpenses > 0 ? saved / monthlyExpenses : 0;
          const pct = target > 0 ? Math.min(100, (saved / target) * 100) : 0;
          return <>
            <BackBar title="Emergency fund" onBack={() => setToolView("menu")} />
            <Card>
              <Label text="Your safety net" hint="How many months you could cover if income stopped." />
              <div style={{ fontSize: "36px", fontWeight: 800, color: covered >= emMonths ? C.up : C.accent, letterSpacing: "-0.02em" }}>{covered.toFixed(1)} mo</div>
              <div style={{ height: "8px", borderRadius: "4px", background: C.border, overflow: "hidden", margin: "8px 0 6px" }}>
                <div style={{ height: "100%", width: pct + "%", background: covered >= emMonths ? C.up : C.accent, borderRadius: "4px" }} />
              </div>
              <div style={{ fontSize: "12px", color: C.sub }}>{saved >= target ? "You've hit your target — nice." : `${fmt(target - saved)} to go to reach ${emMonths} months.`}</div>
            </Card>
            <Card>
              <Label text="Your numbers" hint="Based on your monthly spending." />
              <SliderRow label="Target months" hint="3 is a minimum, 6 is comfortable." value={emMonths} min={1} max={12} step={1} onChange={setEmMonths} display={emMonths + " months"} />
              <div style={{ fontSize: "11px", color: C.hint, margin: "4px 0" }}>Saved so far ({curSymbol()})</div>
              <input type="number" placeholder="e.g. 3000" value={emSaved} onChange={e => setEmSaved(e.target.value)} style={inputStyle} />
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
              <Metric label="Monthly expenses" value={fmt(monthlyExpenses)} desc="From your split" />
              <Metric label="Target fund" value={fmtK(target)} desc={`${emMonths} months covered`} positive={true} />
            </div>
          </>;
        })()}

        {/* ── FINANCIAL HEALTH (Tools) ── */}
        {tab === "tools" && toolView === "health" && <>
          <BackBar title="Financial health" onBack={() => setToolView("menu")} />
          <Card>
            <Label text="Your score" hint="A snapshot of your money habits, out of 100." />
            <div style={{ display: "flex", alignItems: "baseline", gap: "10px" }}>
              <div style={{ fontSize: "44px", fontWeight: 800, color: healthBand.c, letterSpacing: "-0.02em" }}>{healthScore}</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: healthBand.c }}>{healthBand.t}</div>
            </div>
            <div style={{ height: "8px", borderRadius: "4px", background: C.border, overflow: "hidden", marginTop: "8px" }}>
              <div style={{ height: "100%", width: healthScore + "%", background: healthBand.c, borderRadius: "4px" }} />
            </div>
          </Card>
          <Card>
            <Label text="What's behind it" hint="Four pillars, 25 points each." />
            {healthPillars.map(p => (
              <div key={p.label} style={{ marginBottom: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", marginBottom: "5px" }}>
                  <span style={{ color: C.text, fontWeight: 500 }}>{p.label}</span>
                  <span style={{ color: C.sub }}>{p.score}/25</span>
                </div>
                <div style={{ height: "6px", borderRadius: "3px", background: C.border, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: (p.score / 25 * 100) + "%", background: p.score >= 18 ? C.up : p.score >= 10 ? C.accent : C.down, borderRadius: "3px" }} />
                </div>
                {p.score < 18 && <div style={{ fontSize: "11px", color: C.hint, marginTop: "4px" }}>{p.tip}</div>}
              </div>
            ))}
          </Card>
        </>}

        {/* ── CALENDAR (Tools) ── */}
        {tab === "tools" && toolView === "calendar" && (() => {
          const now = new Date();
          const year = now.getFullYear(), month = now.getMonth();
          const monthName = now.toLocaleString("en-US", { month: "long" });
          const daysInMonth = new Date(year, month + 1, 0).getDate();
          const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
          const byDay = {};
          subs.forEach(s => { const d = s.day || 1; (byDay[d] = byDay[d] || []).push(s); });
          const monthlyDue = subs.reduce((a, s) => a + (s.cycle === "yearly" ? 0 : (s.amount || 0)), 0);
          const cells = [];
          for (let i = 0; i < firstDow; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          return <>
            <BackBar title="Calendar" onBack={() => setToolView("menu")} />
            <Card>
              <Label text={monthName + " " + year} hint="Days with a subscription charge are highlighted." />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "4px", marginTop: "4px" }}>
                {["M","T","W","T","F","S","S"].map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: "10px", color: C.hint, padding: "2px 0" }}>{d}</div>)}
                {cells.map((d, i) => {
                  const has = d && byDay[d];
                  const isToday = d === now.getDate();
                  return (
                    <div key={i} style={{ aspectRatio: "1", borderRadius: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", fontSize: "12px",
                      background: has ? C.accent + "22" : "transparent", border: isToday ? "1px solid " + C.accent : "none",
                      color: d ? (has ? C.accent : C.sub) : "transparent", fontWeight: has ? 700 : 400 }}>
                      {d || ""}
                      {has && <span style={{ width: 4, height: 4, borderRadius: "50%", background: C.accent, marginTop: "2px" }} />}
                    </div>
                  );
                })}
              </div>
            </Card>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
              <Metric label="Due this month" value={fmt(monthlyDue)} desc="Recurring charges" positive={false} />
              <Metric label="Subscriptions" value={subs.length} desc="Tracked" />
            </div>
            {subs.length === 0 && <div style={{ fontSize: "12px", color: C.hint, textAlign: "center", padding: "10px 0" }}>Add subscriptions (with a billing day) to see them here.</div>}
          </>;
        })()}

        {/* ── LOG ── */}
        {tab === "home" && homeView === "activity" && <>
          <BackBar title="Activity" onBack={() => setHomeView("dash")} />
          {entries.length >= 2 ? (
            <Card>
              <Label text="Balance over time" hint="Your net invested, building up across every transaction." />
              <LogChart entries={entries} />
            </Card>
          ) : (
            <Card>
              <Label text="Activity" hint="Your transactions and balance over time will appear here." />
              <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6 }}>Log a couple of transactions below and your balance chart shows up automatically. In the future this can fill in straight from your bank.</div>
            </Card>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginBottom: "10px" }}>
            <Metric label="Total deposited"  value={fmtK(totalDep)}           desc="All money put in" positive={true} />
            <Metric label="Total withdrawn"  value={fmtK(totalWith)}           desc="Taken out" positive={false} />
            <Metric label="Net invested"     value={fmtK(totalDep-totalWith)}  desc="Still working" positive={true} />
            <Metric label="Transactions"     value={entries.length}             desc="Entries logged" />
          </div>

          <div data-tour="addtxn">
          {!logAddOpen ? (
            <button onClick={() => setLogAddOpen(true)} style={{ width: "100%", padding: "13px", borderRadius: "12px", cursor: "pointer", fontWeight: 700, fontSize: "14px", border: "0.5px dashed " + C.accent, background: C.accent + "14", color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
              <span style={{ fontSize: "16px", lineHeight: 1 }}>+</span> Add a transaction
            </button>
          ) : (
            <div className="ffade">
              <Card>
                <Label text="Add a transaction" hint="Record every time you invest or take money out." />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px", marginBottom: "12px" }}>
                  {["deposit","withdrawal"].map(t => (
                    <button key={t} onClick={() => setLogType(t)} style={{
                      padding: "10px", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "13px",
                      border: "0.5px solid " + (logType === t ? (t === "deposit" ? C.up : C.down) : C.border),
                      background: logType === t ? (t === "deposit" ? C.up + "18" : C.down + "18") : C.surface,
                      color: logType === t ? (t === "deposit" ? C.up : C.down) : C.sub,
                    }}>{t === "deposit" ? "+ Deposit" : "− Withdrawal"}</button>
                  ))}
                </div>
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Date</div>
                  <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)} aria-label="Transaction date" style={inputStyle} />
                </div>
                <div style={{ marginBottom: "8px" }}>
                  <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Amount ({curSymbol()})</div>
                  <input type="number" placeholder="e.g. 200" value={logAmount} onChange={e => setLogAmount(e.target.value)} aria-label="Transaction amount" min="0" style={inputStyle} />
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Note <span style={{ color: C.hint }}>(optional)</span></div>
                  <input type="text" placeholder="e.g. Monthly VUAA buy" value={logNote} onChange={e => setLogNote(e.target.value)} aria-label="Transaction note" style={inputStyle} />
                </div>
                <button onClick={() => { if (parseFloat(logAmount) > 0) { addEntry(); setLogAddOpen(false); } }} style={{ width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "14px", cursor: "pointer", letterSpacing: "-0.01em" }}>
                  Save transaction
                </button>
              </Card>
              <button onClick={() => setLogAddOpen(false)} style={{ width: "100%", marginTop: "8px", padding: "10px", borderRadius: "10px", border: "none", background: "transparent", color: C.hint, fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
            </div>
          )}
          </div>

          {entries.length > 0 ? (
            <Card>
              <Label text="History" hint="All transactions, newest first." />
              {entries.map(e => (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 0", borderTop: "0.5px solid " + C.border }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: e.type === "deposit" ? C.up + "18" : C.down + "18" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={e.type === "deposit" ? C.up : C.down} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      {e.type === "deposit" ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></> : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>}
                    </svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 600, fontSize: "14px", color: e.type === "deposit" ? C.up : C.down }}>{e.type === "deposit" ? "+" : "−"}{fmt(e.amount)}</span>
                      <span style={{ fontSize: "11px", color: C.hint }}>{e.date}</span>
                    </div>
                    {e.note && <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.note}</div>}
                  </div>
                  <button onClick={() => persist(entries.filter(x => x.id !== e.id))} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", padding: "4px", fontSize: "14px" }}>✕</button>
                </div>
              ))}
            </Card>
          ) : (
            <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: C.hint }}>
              <div style={{ marginBottom: "10px", opacity: 0.4 }}>{ICONS.log}</div>
              <div style={{ fontSize: "14px", fontWeight: 500, color: C.sub }}>No transactions yet</div>
              <div style={{ fontSize: "12px", color: C.hint, marginTop: "4px" }}>Add your first deposit above.</div>
            </div>
          )}
        </>}

        {/* ── MORE ── */}
        {tab === "more" && (moreView === "menu" ? <>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: 46, height: 46, borderRadius: "50%", background: C.accent + "22", color: C.accent, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: "18px", textTransform: "uppercase" }}>{(profile.first?.[0] || session?.user?.email?.[0] || "?")}</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "15px", fontWeight: 700 }}>{(profile.first || profile.last) ? `${profile.first} ${profile.last}`.trim() : "Your account"}</div>
                <div style={{ fontSize: "12px", color: C.hint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session?.user?.email || "Not signed in"}</div>
              </div>
            </div>
          </Card>
          <Card style={{ paddingTop: "2px", paddingBottom: "2px" }}>
            <NavRow label="Account" desc="Name, language, currency, delete" onClick={() => setMoreView("account")} />
            <NavRow label="Membership" desc="Your plan & upgrade" onClick={() => setMoreView("membership")} />
            <NavRow label="Notifications" desc="Reminders & alerts" onClick={() => setMoreView("notifications")} />
            <NavRow label="Appearance" desc="Theme & accent color" onClick={() => setMoreView("appearance")} />
            <NavRow label="Your stats" desc="Time in app & fun numbers" onClick={() => setMoreView("stats")} />
            <NavRow label="Data & backup" desc="Export or import your data" onClick={() => setMoreView("data")} />
            <NavRow label="Security" desc="Passcode & Face ID" onClick={() => setMoreView("security")} />
            <NavRow label="Tutorial" desc="A quick guided tour of Folio" onClick={() => setShowTour(true)} />
            <NavRow label="Help & support" desc="FAQs & contact" onClick={() => setMoreView("help")} />
            <NavRow label="Report a bug" desc="Something broken? Let us know" onClick={() => setMoreView("bug")} />
            <NavRow label="Suggest a feature" desc="Ideas for new tools & features" onClick={() => setMoreView("idea")} />
            <NavRow label="Privacy policy" desc="What we store & your controls" onClick={() => setMoreView("privacy")} />
          </Card>
          {session && <button onClick={() => onSignOut && onSignOut()} style={{ width: "100%", padding: "13px", borderRadius: "12px", border: "0.5px solid " + C.down, background: C.down + "18", color: C.down, fontWeight: 700, fontSize: "14px", cursor: "pointer" }}>Sign out</button>}
        </> : <>
          {moreView === "account" && <>
            <BackBar title="Account" onBack={() => setMoreView("menu")} />
            <Card>
              <Label text="Profile" hint="Your name across the app." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
                <input placeholder="First name" value={profile.first} onChange={e => setProfile({ ...profile, first: e.target.value })} style={inputStyle} />
                <input placeholder="Last name" value={profile.last} onChange={e => setProfile({ ...profile, last: e.target.value })} style={inputStyle} />
              </div>
              <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Email</div>
              <input value={session?.user?.email || ""} disabled style={{ ...inputStyle, opacity: 0.6 }} />
            </Card>
            <Card style={{ paddingTop: "2px", paddingBottom: "2px" }}>
              {(() => { const lg = LANGUAGES.find(l => l.code === (theme?.language || "en")) || LANGUAGES[0]; return <NavRow label="Language" desc={`${lg.label} · ${lg.native}`} onClick={() => setMoreView("language")} />; })()}
              {(() => { const cc = CURRENCIES.find(c => c.code === (theme?.currency || "EUR")) || CURRENCIES[0]; return <NavRow label="Currency" desc={`${cc.symbol} ${cc.code} · ${cc.label}`} onClick={() => setMoreView("currency")} />; })()}
            </Card>
            <Card>
              <Label text="Danger zone" hint="Permanently deletes your account and all your data. This can't be undone." />
              <button disabled={deleting} onClick={async () => {
                if (!window.confirm("Permanently delete your account and ALL your data? This cannot be undone.")) return;
                setDeleting(true);
                try {
                  await onDeleteAccount();
                  try { localStorage.removeItem(LOCAL_KEY); } catch {}
                  // onDeleteAccount signs out, which swaps back to the login screen
                } catch (e) {
                  setDeleting(false);
                  alert("Couldn't delete the account: " + (e?.message || e));
                }
              }} style={{ width: "100%", padding: "12px", borderRadius: "10px", border: "0.5px solid " + C.down, background: C.down + "18", color: C.down, fontWeight: 700, fontSize: "13px", cursor: deleting ? "default" : "pointer", opacity: deleting ? 0.6 : 1 }}>
                {deleting ? "Deleting…" : "Delete account"}
              </button>
            </Card>
          </>}

          {moreView === "language" && <>
            <BackBar title="Language" onBack={() => setMoreView("account")} />
            <Card>
              <Label text="App language" hint="Pick your language. Full translations are rolling out — the interface stays English until each one's ready." />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {LANGUAGES.map(lg => {
                  const on = (theme?.language || "en") === lg.code;
                  return (
                    <button key={lg.code} onClick={() => setTheme && setTheme({ language: lg.code })} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "11px 12px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, textAlign: "left",
                      border: "1px solid " + (on ? C.accent : C.border), background: on ? C.accent + "18" : C.surface, color: on ? C.accent : C.text,
                    }}>
                      <span>{lg.label} <span style={{ color: C.hint, fontWeight: 400 }}>· {lg.native}</span></span>
                      {on && <span style={{ fontSize: "12px" }}>✓</span>}
                    </button>
                  );
                })}
              </div>
            </Card>
          </>}

          {moreView === "currency" && <>
            <BackBar title="Currency" onBack={() => setMoreView("account")} />
            <Card>
              <Label text="Currency" hint="Used for every amount in the app." />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
                {CURRENCIES.map(cu => {
                  const on = (theme?.currency || "EUR") === cu.code;
                  return (
                    <button key={cu.code} onClick={() => setTheme && setTheme({ currency: cu.code })} style={{
                      padding: "11px 12px", borderRadius: "10px", cursor: "pointer", fontSize: "13px", fontWeight: 600, textAlign: "left",
                      border: "1px solid " + (on ? C.accent : C.border), background: on ? C.accent + "18" : C.surface, color: on ? C.accent : C.text,
                    }}>{cu.symbol} {cu.code} <span style={{ color: C.hint, fontWeight: 400 }}>· {cu.label}</span></button>
                  );
                })}
              </div>
            </Card>
          </>}

          {moreView === "appearance" && <>
            <BackBar title="Appearance" onBack={() => setMoreView("menu")} />
            <Card>
              <Label text="Theme" hint="Choose light or dark." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "18px" }}>
                {[["light", "Light"], ["dark", "Dark"]].map(([m, lbl]) => {
                  const on = (theme?.mode || "dark") === m;
                  return (
                    <button key={m} onClick={() => setTheme && setTheme({ mode: m })} style={{ padding: "12px", borderRadius: "12px", cursor: "pointer", fontWeight: 600, fontSize: "13px", border: "1px solid " + (on ? C.accent : C.border), background: on ? C.accent + "18" : C.surface, color: on ? C.accent : C.sub }}>{lbl}</button>
                  );
                })}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", paddingTop: "14px", borderTop: "0.5px solid " + C.border }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>Helper texts</div>
                  <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px", lineHeight: 1.45 }}>The little explanations under each section. Turn off for a cleaner, expert view.</div>
                </div>
                <button
                  role="switch"
                  aria-checked={showHints}
                  aria-label="Toggle helper texts"
                  onClick={() => setTheme && setTheme({ showHints: !showHints })}
                  style={{ flexShrink: 0, width: 46, height: 28, borderRadius: "999px", border: "none", cursor: "pointer", padding: 0, position: "relative", background: showHints ? C.up : C.border, transition: "background .2s" }}
                >
                  <span style={{ position: "absolute", top: 3, left: showHints ? 21 : 3, width: 22, height: 22, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)", transition: "left .2s" }} />
                </button>
              </div>
            </Card>
          </>}

          {moreView === "bug" && <>
            <BackBar title="Report a bug" onBack={() => setMoreView("menu")} />
            <Feedback kind="bug" userId={userId} />
          </>}

          {moreView === "idea" && <>
            <BackBar title="Suggest a feature" onBack={() => setMoreView("menu")} />
            <Feedback kind="idea" userId={userId} />
          </>}

          {moreView === "data" && <>
            <BackBar title="Data & backup" onBack={() => setMoreView("menu")} />
            <Card>
              <Label text="Backup" hint={userId ? "Your data syncs to your account. Export a file copy too." : "Save a copy or restore from a file."} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: "8px" }}>
                <button onClick={exportData} style={{ padding: "11px", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "13px", border: "0.5px solid " + C.border, background: C.surface, color: C.text }}>↓ Export</button>
                <button onClick={() => fileRef.current?.click()} style={{ padding: "11px", borderRadius: "10px", cursor: "pointer", fontWeight: 600, fontSize: "13px", border: "0.5px solid " + C.border, background: C.surface, color: C.text }}>↑ Import</button>
              </div>
            </Card>
          </>}

          {moreView === "security" && <>
            <BackBar title="Security" onBack={() => setMoreView("menu")} />
            <Card>
              <Label text="App lock" hint="Coming soon." />
              <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6 }}>A passcode and Face ID / fingerprint unlock are on the way — they'll arrive with the native app so they can use your device's secure lock.</div>
            </Card>
          </>}

          {moreView === "membership" && <>
            <BackBar title="Membership" onBack={() => setMoreView("menu")} />
            <Card>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 700 }}>Folio Free</div>
                  <div style={{ fontSize: "12px", color: C.hint, marginTop: "2px" }}>Your current plan</div>
                </div>
                <span style={{ fontSize: "11px", fontWeight: 700, color: C.up, background: C.up + "18", padding: "4px 10px", borderRadius: "20px" }}>ACTIVE</span>
              </div>
              <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6 }}>Folio Pro is on the way — unlocking advanced tools, bank connections and more. You'll be able to upgrade right here.</div>
            </Card>
            <button disabled style={{ width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: C.accent, color: C.onAccent, fontWeight: 700, fontSize: "14px", opacity: 0.5, cursor: "default" }}>Upgrade to Pro — coming soon</button>
          </>}

          {moreView === "notifications" && <>
            <BackBar title="Notifications" onBack={() => setMoreView("menu")} />
            <Card>
              <Label text="Notifications" hint="Coming soon." />
              <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6 }}>Reminders to log transactions, monthly check-ins and goal alerts will live here — arriving with the native app so they can use real push notifications.</div>
            </Card>
          </>}

          {moreView === "stats" && (() => {
            const u = usage.current;
            const since = u.firstDay ? new Date(u.firstDay).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "today";
            const biggest = entries.reduce((m, e) => Math.max(m, e.amount || 0), 0);
            const avgTxn = entries.length ? (totalDep + totalWith) / entries.length : 0;
            const goalsDone = goals.filter(g => (g.saved || 0) >= (g.target || 0) && (g.target || 0) > 0).length;
            return <>
              <BackBar title="Your stats" onBack={() => setMoreView("menu")} />
              <Card>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.hint }}>Time in Folio</div>
                <div className="tnum" style={{ fontSize: "34px", fontWeight: 800, letterSpacing: "-0.03em", marginTop: "4px", color: C.text }}>{fmtDuration(u.seconds)}</div>
                <div style={{ fontSize: "12px", color: C.sub, marginTop: "2px" }}>Across {u.sessions} session{u.sessions === 1 ? "" : "s"} · since {since}</div>
              </Card>
              <Label text="Your journey" hint="The fun numbers behind your money." />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "8px", marginBottom: "10px" }}>
                <Metric label="Days active" value={(u.days?.length || 0)} desc="Days you opened Folio" />
                <Metric label="Transactions" value={entries.length} desc="Logged so far" />
                <Metric label="Net worth" value={fmtK(netWorth)} desc="Right now" positive={netWorth >= 0} />
                <Metric label="Net invested" value={fmtK(totalDep - totalWith)} desc="Still working for you" positive={true} />
                <Metric label="Total deposited" value={fmtK(totalDep)} desc="Money put in" positive={true} />
                <Metric label="Total withdrawn" value={fmtK(totalWith)} desc="Taken out" positive={false} />
                <Metric label="Biggest single" value={fmtK(biggest)} desc="Largest transaction" />
                <Metric label="Avg. transaction" value={fmtK(avgTxn)} desc="Per entry" />
                <Metric label="Goals" value={`${goalsDone}/${goals.length}`} desc="Reached / set" positive={goalsDone > 0} />
                <Metric label="Subscriptions" value={subs.length} desc={`${fmt(subsMonthly)}/mo tracked`} positive={false} />
                <Metric label="Health score" value={healthScore + "/100"} desc={healthBand.t} positive={healthScore >= 60} />
                <Metric label="Savings rate" value={Math.round(income > 0 ? (investable / income) * 100 : 0) + "%"} desc="Of your income" positive={true} />
              </div>
              <div style={{ fontSize: "11px", color: C.hint, textAlign: "center", padding: "4px 0 6px" }}>Time is tracked on this device only and never leaves it.</div>
            </>;
          })()}

          {moreView === "help" && <>
            <BackBar title="Help & support" onBack={() => setMoreView("menu")} />
            <Card>
              <Label text="Get help" hint="We're here for you." />
              <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6, marginBottom: "12px" }}>FAQs and in-app guides are coming. For now, reach out any time:</div>
              <a href="mailto:support@folio.app" style={{ display: "block", padding: "11px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.accent, fontSize: "13px", fontWeight: 600, textDecoration: "none" }}>✉ support@folio.app</a>
            </Card>
          </>}

          {moreView === "privacy" && <>
            <BackBar title="Privacy" onBack={() => setMoreView("menu")} />
            <Card>
              <Label text="Privacy policy" hint="Last updated 14 Jun 2026." />
              <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.65 }}>
                <p style={{ marginTop: 0 }}><strong style={{ color: C.text }}>What we store.</strong> Your email/login (via Supabase) and the plan figures you enter — income, budget, investments, net-worth items, goals, subscriptions, and your transaction log. Folio does not connect to your bank and never sells your data.</p>
                <p><strong style={{ color: C.text }}>Where it lives.</strong> A copy stays on your device so the app works offline, and a copy syncs to our cloud so you can log in anywhere. Row-level security means only you can read or write your own data.</p>
                <p><strong style={{ color: C.text }}>Your controls.</strong> Export a full backup any time from Data &amp; backup, and permanently delete your account and all cloud data from Account → Delete account.</p>
                <p style={{ marginBottom: 0 }}><strong style={{ color: C.text }}>Contact.</strong> mathieu.poppe2008@gmail.com</p>
              </div>
            </Card>
          </>}
        </>)}

        <input ref={fileRef} type="file" accept="application/json,.json" onChange={importData} style={{ display: "none" }} />

      </div>

      {/* Bottom tab bar */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: C.glass, backdropFilter: "blur(20px) saturate(160%)", WebkitBackdropFilter: "blur(20px) saturate(160%)", borderTop: "0.5px solid " + C.border, boxShadow: "0 -12px 30px -18px rgba(0,0,0,0.6)", paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ maxWidth: 440, margin: "0 auto", display: "flex", gap: "4px", padding: "8px 10px" }}>
          {[["home","Home"],["tools","Tools"],["more","More"]].map(([id, lbl]) => {
            const active = tab === id;
            return (
              <button key={id} data-tour={"nav-" + id} onClick={() => { setTab(id); if (id === "more") setMoreView("menu"); if (id === "tools") setToolView("menu"); if (id === "home") setHomeView("dash"); }} style={{
                flex: 1, padding: "8px 2px", borderRadius: "13px", border: "none", cursor: "pointer",
                background: active ? C.accent + "1f" : "transparent", color: active ? C.accent : C.sub,
                fontWeight: active ? 700 : 500, fontSize: "10px",
                display: "flex", flexDirection: "column", alignItems: "center", gap: "4px",
              }}>
                {ICONS[id]}
                {lbl}
              </button>
            );
          })}
        </div>
      </div>

      {showTour && <Tutorial onClose={closeTour} onNavigate={(t) => { setTab(t); if (t === "more") setMoreView("menu"); if (t === "tools") setToolView("menu"); if (t === "home") setHomeView("dash"); }} />}
    </div>
    </HintCtx.Provider>
  );
}
