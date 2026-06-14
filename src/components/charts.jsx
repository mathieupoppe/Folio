// Pure SVG chart components. Depend only on the theme (C, fmt, fmtK).
import { C, fmtK } from "../theme";

// growth projection: balance vs. contributions over the years
export function GrowthChart({ data, principal, monthly }) {
  if (!data.length) return null;
  const years = data.length;
  const vals = data.map(d => d.balance);
  const contribs = data.map((_, i) => principal + monthly * 12 * (i + 1));
  const maxVal = Math.max(...vals);
  const W = 340, H = 140, PL = 44, PR = 8, PT = 10, PB = 28;
  const iw = W - PL - PR, ih = H - PT - PB;
  const px = i => PL + (i / (years - 1 || 1)) * iw;
  const py = v => PT + ih - (v / (maxVal || 1)) * ih;

  const balPath = data.map((d, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(d.balance).toFixed(1)}`).join(" ");
  const contPath = contribs.map((v, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(" ");
  const areaPath = balPath + ` L${px(years - 1)},${PT + ih} L${px(0)},${PT + ih} Z`;

  const ticks = years <= 10 ? data.map((_, i) => i) : [0, Math.floor(years * 0.25), Math.floor(years * 0.5), Math.floor(years * 0.75), years - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = PT + ih * f;
        const v = maxVal * (1 - f);
        return <g key={f}>
          <line x1={PL} x2={W - PR} y1={y} y2={y} stroke={C.border} strokeWidth="0.5" />
          <text x={PL - 4} y={y + 4} textAnchor="end" fontSize="9" fill={C.hint}>{fmtK(v)}</text>
        </g>;
      })}
      <path d={areaPath} fill="url(#ag)" />
      <path d={contPath} fill="none" stroke={C.hint} strokeWidth="1.2" strokeDasharray="4 3" />
      <path d={balPath} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" />
      {ticks.map(i => (
        <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9" fill={C.hint}>
          {data[i].year}yr
        </text>
      ))}
    </svg>
  );
}

// cumulative balance over time from the transaction log
export function LogChart({ entries }) {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  const pts = sorted.map(e => { bal += e.type === "deposit" ? e.amount : -e.amount; return { date: e.date, bal }; });
  const vals = pts.map(p => p.bal);
  const maxV = Math.max(...vals, 0), minV = Math.min(...vals, 0);
  const range = maxV - minV || 1;
  const W = 340, H = 132, PL = 46, PR = 8, PT = 10, PB = 24, iw = W - PL - PR, ih = H - PT - PB;
  const px = i => PL + (i / (pts.length - 1 || 1)) * iw;
  const py = v => PT + ih - ((v - minV) / range) * ih;
  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.bal).toFixed(1)}`).join(" ");
  const area = line + ` L${px(pts.length - 1).toFixed(1)},${(PT + ih).toFixed(1)} L${px(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`;
  const ticks = [0, Math.floor((pts.length - 1) / 2), pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={C.accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map(f => {
        const y = PT + ih * f, v = maxV - (maxV - minV) * f;
        return <g key={f}>
          <line x1={PL} x2={W - PR} y1={y} y2={y} stroke={C.border} strokeWidth="0.5" />
          <text x={PL - 4} y={y + 3} textAnchor="end" fontSize="9" fill={C.hint}>{fmtK(v)}</text>
        </g>;
      })}
      <path d={area} fill="url(#lg)" />
      <path d={line} fill="none" stroke={C.accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {ticks.map(i => <text key={i} x={px(i)} y={H - 6} textAnchor="middle" fontSize="9" fill={C.hint}>{pts[i].date.slice(2)}</text>)}
    </svg>
  );
}

// net worth over time, filtered to a period (1D/1W/1M/1Y/MAX)
export function NetWorthChart({ history, period, current }) {
  const days = { "1D": 1, "1W": 7, "1M": 30, "1Y": 365, "MAX": Infinity }[period] ?? 30;
  const cutoff = isFinite(days) ? new Date(Date.now() - days * 86400000).toISOString().slice(0, 10) : "";
  let pts = (history || []).filter(p => period === "MAX" || p.date >= cutoff);
  if (pts.length === 0) pts = [{ date: new Date().toISOString().slice(0, 10), value: current }];
  if (pts.length < 2) {
    return <div style={{ fontSize: "12px", color: C.hint, padding: "20px 0", textAlign: "center" }}>Your net worth graph fills in as the days go by.</div>;
  }
  const vals = pts.map(p => p.value);
  const maxV = Math.max(...vals), minV = Math.min(...vals), range = (maxV - minV) || 1;
  const flat = maxV === minV; // no movement yet — avoid the half-filled-rectangle look
  const W = 340, H = 120, PL = 8, PR = 8, PT = 10, PB = 8, iw = W - PL - PR, ih = H - PT - PB;
  const px = i => PL + (i / (pts.length - 1)) * iw;
  const py = v => flat ? PT + ih / 2 : PT + ih - ((v - minV) / range) * ih;
  const col = pts[pts.length - 1].value >= pts[0].value ? C.up : C.down;
  const lastX = px(pts.length - 1), lastY = py(pts[pts.length - 1].value);

  // Flat data: a single clean baseline with end dot — no big gradient block.
  if (flat) {
    const y = (PT + ih / 2).toFixed(1);
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
        <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={C.border} strokeWidth="2" strokeLinecap="round" strokeDasharray="2 6" />
        <circle cx={lastX} cy={y} r="3.5" fill={C.accent} />
        <text x={W / 2} y={Number(y) + 22} textAnchor="middle" fontSize="10" fill={C.hint}>No change yet — your line grows as your net worth moves.</text>
      </svg>
    );
  }

  const line = pts.map((p, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(p.value).toFixed(1)}`).join(" ");
  const area = line + ` L${lastX.toFixed(1)},${(PT + ih).toFixed(1)} L${px(0).toFixed(1)},${(PT + ih).toFixed(1)} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", overflow: "visible" }}>
      <defs><linearGradient id="nwg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.2" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
      <path d={area} fill="url(#nwg)" />
      <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="3.5" fill={col} />
    </svg>
  );
}

// donut chart with legend — segments: [{ label, value, color }]
export function Donut({ segments, centerTop, centerMain }) {
  const segs = segments.filter(s => s.value > 0);
  const total = segs.reduce((s, x) => s + x.value, 0) || 1;
  const R = 52, sw = 20, CIRC = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
      <svg width="128" height="128" viewBox="0 0 128 128" style={{ flexShrink: 0 }}>
        <circle cx="64" cy="64" r={R} fill="none" stroke={C.border} strokeWidth={sw} />
        <g transform="rotate(-90 64 64)">
          {segs.map((s, i) => {
            const dash = (s.value / total) * CIRC;
            const el = <circle key={i} cx="64" cy="64" r={R} fill="none" stroke={s.color} strokeWidth={sw} strokeDasharray={`${dash.toFixed(2)} ${(CIRC - dash).toFixed(2)}`} strokeDashoffset={(-offset).toFixed(2)} />;
            offset += dash; return el;
          })}
        </g>
        {centerTop && <text x="64" y="60" textAnchor="middle" fontSize="10" fill={C.hint}>{centerTop}</text>}
        {centerMain && <text x="64" y="76" textAnchor="middle" fontSize="15" fontWeight="700" fill={C.text}>{centerMain}</text>}
      </svg>
      <div style={{ flex: 1, minWidth: 120 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "3px 0" }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: "12px", color: C.sub, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.label}</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: C.text }}>{Math.round((s.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
