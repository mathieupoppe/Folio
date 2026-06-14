import { useState } from "react";
import { C } from "./theme";
import { supabase } from "./supabase";

export default function Auth() {
  const [mode, setMode]   = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [pw, setPw]       = useState("");
  const [busy, setBusy]   = useState(false);
  const [msg, setMsg]     = useState(null);
  const [err, setErr]     = useState(null);

  const submit = async e => {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (!email || !pw) { setErr("Enter an email and password."); return; }
    if (pw.length < 6) { setErr("Password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password: pw });
        if (error) throw error;
        setMsg("Account created! If email confirmation is on, check your inbox — otherwise just log in.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
        // on success, App's auth listener swaps to the app automatically
      }
    } catch (e2) {
      setErr(e2.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // social login — redirects to the provider, then back to the app
  const oauth = async provider => {
    setErr(null); setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(error.message === "Unsupported provider" || /not enabled/i.test(error.message)
      ? `${provider === "google" ? "Google" : "Apple"} sign-in isn't enabled in Supabase yet.`
      : error.message);
  };

  const providerBtn = { width: "100%", padding: "12px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontWeight: 600, fontSize: "14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", marginBottom: "9px" };

  const input = { width: "100%", padding: "12px 14px", borderRadius: "11px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "14px", outline: "none", color: C.text, marginBottom: "10px" };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, backgroundImage: C.bgGlow, backgroundAttachment: "fixed", fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", color: C.text, display: "flex", alignItems: "center", justifyContent: "center", padding: "1.2rem" }}>
      <style>{`::placeholder{ color:${C.hint}; } input{ color:${C.text}; } body{ -webkit-font-smoothing:antialiased; } button{ transition: transform .12s ease, filter .18s ease; } button:active{ transform: translateY(1px) scale(0.995); }`}</style>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "11px", justifyContent: "center", marginBottom: "26px" }}>
          <div style={{ width: 40, height: 40, borderRadius: "13px", background: C.accentGrad, boxShadow: C.glow + ", " + C.hi, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
          </div>
          <div style={{ fontSize: "23px", fontWeight: 800, letterSpacing: "-0.03em" }}>Folio</div>
        </div>

        <div style={{ background: C.cardGrad, borderRadius: "20px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.5rem 1.35rem" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, marginBottom: "4px" }}>{mode === "login" ? "Welcome back" : "Create your account"}</div>
          <div style={{ fontSize: "12px", color: C.hint, marginBottom: "18px" }}>{mode === "login" ? "Log in to access your plan on any device." : "Sign up to save your plan to the cloud."}</div>

          <form onSubmit={submit}>
            <input type="email" placeholder="you@email.com" value={email} onChange={e => setEmail(e.target.value)} style={input} autoComplete="email" aria-label="Email address" />
            <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} style={input} autoComplete={mode === "login" ? "current-password" : "new-password"} aria-label="Password" />

            {err && <div style={{ fontSize: "12px", color: C.down, marginBottom: "10px" }}>{err}</div>}
            {msg && <div style={{ fontSize: "12px", color: C.up, marginBottom: "10px" }}>{msg}</div>}

            <button type="submit" disabled={busy} style={{ width: "100%", padding: "14px", borderRadius: "13px", border: "none", background: C.accentGrad, boxShadow: busy ? "none" : C.glow, color: "#fff", fontWeight: 700, fontSize: "14px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1 }}>
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Sign up"}
            </button>
          </form>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0" }}>
            <div style={{ flex: 1, height: "0.5px", background: C.border }} />
            <span style={{ fontSize: "11px", color: C.hint }}>or continue with</span>
            <div style={{ flex: 1, height: "0.5px", background: C.border }} />
          </div>

          <button type="button" onClick={() => oauth("google")} style={providerBtn}>
            <svg width="17" height="17" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22 22-9.8 22-22c0-1.3-.1-2.3-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.1 29.6 2 24 2 16.3 2 9.7 6.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 46c5.5 0 10.5-2.1 14.3-5.6l-6.6-5.6C29.7 36.5 27 37.5 24 37.5c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 41.6 16.2 46 24 46z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.6C41.6 35.9 46 30.6 46 24c0-1.3-.1-2.3-.4-3.5z"/></svg>
            Google
          </button>
          {/* Apple sign-in hidden for now — needs a paid Apple Developer account to configure.
              Re-add this button once the Apple provider is set up in Supabase:
          <button type="button" onClick={() => oauth("apple")} style={providerBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={C.text}><path d="M17.05 12.04c-.03-2.6 2.13-3.85 2.22-3.91-1.21-1.77-3.1-2.01-3.77-2.04-1.6-.16-3.13.94-3.94.94-.81 0-2.07-.92-3.4-.89-1.75.03-3.36 1.02-4.26 2.58-1.82 3.16-.47 7.84 1.3 10.41.86 1.26 1.89 2.67 3.24 2.62 1.3-.05 1.79-.84 3.36-.84 1.57 0 2.01.84 3.39.81 1.4-.03 2.29-1.28 3.15-2.55.99-1.46 1.4-2.88 1.42-2.95-.03-.01-2.72-1.04-2.75-4.13l.39.0zM14.53 4.5c.72-.87 1.2-2.08 1.07-3.28-1.03.04-2.28.69-3.02 1.55-.66.77-1.24 2-.08 3.13 1.13-.09 2.0-.59 2.03-1.4z"/></svg>
            Apple
          </button> */}

          <div style={{ fontSize: "12px", color: C.sub, textAlign: "center", marginTop: "16px" }}>
            {mode === "login" ? "No account yet? " : "Already have one? "}
            <span onClick={() => { setMode(mode === "login" ? "signup" : "login"); setErr(null); setMsg(null); }} style={{ color: C.accent, cursor: "pointer", fontWeight: 600 }}>
              {mode === "login" ? "Sign up" : "Log in"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
