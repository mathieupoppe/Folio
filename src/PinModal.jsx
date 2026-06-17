import { useState } from "react";
import { C } from "./theme";
import { hashPin, readLock } from "./lock";

// In-app PIN pad modal (replaces window.prompt — works reliably on web + mobile).
// mode "set"    → enter a new PIN, then confirm it → onDone(hashedPin)
// mode "verify" → enter the current PIN → onDone(true)  (the security check)
// On native, the "verify" step is where Face ID / fingerprint will be offered.
export default function PinModal({ mode = "set", title, onDone, onClose }) {
  const [stage, setStage] = useState(mode === "verify" ? "verify" : "enter"); // verify | enter | confirm
  const [first, setFirst] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const storedPin = readLock().pin;
  const buzz = () => { if (navigator.vibrate) navigator.vibrate(80); };

  const heading = stage === "verify" ? (title || "Enter your current PIN")
    : stage === "enter" ? (title || "Choose a 4-digit PIN")
    : "Confirm your PIN"; // confirm step always says this, even when a title was given

  const complete = val => {
    if (stage === "verify") {
      if (hashPin(val) === storedPin) onDone(true);
      else { setErr("Wrong PIN — try again"); setPin(""); buzz(); }
    } else if (stage === "enter") {
      setFirst(val); setPin(""); setErr(""); setStage("confirm");
    } else {
      if (val === first) onDone(hashPin(val));
      else { setErr("PINs didn't match — start over"); setPin(""); setFirst(""); setStage("enter"); buzz(); }
    }
  };
  const press = d => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next); setErr("");
    if (next.length === 4) setTimeout(() => complete(next), 110);
  };
  const del = () => setPin(p => p.slice(0, -1));

  const keyBtn = { height: 58, borderRadius: "15px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "21px", fontWeight: 600, cursor: "pointer" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,0.66)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div onClick={e => e.stopPropagation()} className="ffade" style={{ width: "100%", maxWidth: 320, background: C.card, borderRadius: "20px", border: "0.5px solid " + C.border, boxShadow: C.shadow, padding: "1.4rem 1.3rem" }}>
        <div style={{ fontSize: "15px", fontWeight: 800, color: C.text, textAlign: "center" }}>{heading}</div>
        <div style={{ fontSize: "12px", color: err ? C.down : C.hint, textAlign: "center", marginTop: "4px", minHeight: "16px" }}>{err || " "}</div>
        <div style={{ display: "flex", gap: "13px", justifyContent: "center", margin: "16px 0 20px" }}>
          {[0, 1, 2, 3].map(i => <span key={i} style={{ width: 13, height: 13, borderRadius: "50%", background: i < pin.length ? C.accent : "transparent", border: "2px solid " + (i < pin.length ? C.accent : C.border) }} />)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "10px" }}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <button key={n} onClick={() => press(String(n))} style={keyBtn}>{n}</button>)}
          <button onClick={onClose} style={{ ...keyBtn, fontSize: "13px", color: C.sub }}>Cancel</button>
          <button onClick={() => press("0")} style={keyBtn}>0</button>
          <button onClick={del} aria-label="Delete" style={{ ...keyBtn, fontSize: "15px", color: C.sub }}>⌫</button>
        </div>
      </div>
    </div>
  );
}
