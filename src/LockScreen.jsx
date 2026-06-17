import { useState } from "react";
import { C } from "./theme";
import { readLock, writeLock, hashPin } from "./lock";

// Full-screen PIN gate shown when the app lock is enabled.
export default function LockScreen({ onUnlock }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState(false);
  const stored = readLock().pin;

  const submit = next => {
    if (hashPin(next) === stored) { onUnlock(); }
    else { setErr(true); setPin(""); if (navigator.vibrate) navigator.vibrate(80); }
  };
  const press = d => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next); setErr(false);
    if (next.length === 4) setTimeout(() => submit(next), 120);
  };
  const del = () => setPin(p => p.slice(0, -1));

  const forgot = () => {
    if (window.confirm("Forgot your PIN? This turns the app lock off. Your account and data are unaffected — your password still protects them.")) {
      writeLock({ enabled: false, pin: "" });
      onUnlock();
    }
  };

  const keyBtn = { height: 64, borderRadius: "16px", border: "0.5px solid " + C.border, background: C.cardGrad, color: C.text, fontSize: "22px", fontWeight: 600, cursor: "pointer" };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: C.bg, backgroundImage: C.bgGlow, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif" }}>
      <div style={{ width: 46, height: 46, borderRadius: "13px", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.onAccent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
      </div>
      <div style={{ fontSize: "17px", fontWeight: 800, color: C.text, marginBottom: "4px" }}>Folio is locked</div>
      <div style={{ fontSize: "13px", color: err ? C.down : C.sub, marginBottom: "20px" }}>{err ? "Wrong PIN — try again" : "Enter your 4-digit PIN"}</div>

      <div style={{ display: "flex", gap: "14px", marginBottom: "28px" }}>
        {[0, 1, 2, 3].map(i => (
          <span key={i} style={{ width: 14, height: 14, borderRadius: "50%", background: i < pin.length ? C.accent : "transparent", border: "2px solid " + (i < pin.length ? C.accent : C.border), transition: "all .12s" }} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 76px)", gap: "12px" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} onClick={() => press(String(n))} style={keyBtn}>{n}</button>)}
        <span />
        <button onClick={() => press("0")} style={keyBtn}>0</button>
        <button onClick={del} aria-label="Delete" style={{ ...keyBtn, fontSize: "16px", color: C.sub }}>⌫</button>
      </div>

      <button onClick={forgot} style={{ marginTop: "24px", background: "none", border: "none", color: C.hint, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Forgot PIN?</button>
    </div>
  );
}
