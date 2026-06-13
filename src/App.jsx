import { useState, useEffect } from "react";
import { C, applyTheme, applyCurrency, loadTheme } from "./theme";
import { supabase, isConfigured } from "./supabase";
import Auth from "./Auth";
import Folio from "./folio.jsx";

function Centered({ children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Inter','Segoe UI',system-ui,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "1.5rem", textAlign: "center" }}>
      <div style={{ maxWidth: 420 }}>{children}</div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  // appearance (light/dark + accent), persisted; applied to the shared C object
  const [theme, setThemeState] = useState(loadTheme);
  const setTheme = next => {
    const merged = { ...theme, ...next };
    applyTheme(merged.mode, merged.accent);
    applyCurrency(merged.currency);
    try { localStorage.setItem("folio-theme", JSON.stringify(merged)); } catch {}
    setThemeState(merged);
  };

  useEffect(() => {
    if (!isConfigured) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Not set up yet — guide instead of crashing
  if (!isConfigured) return (
    <Centered>
      <div style={{ fontSize: "17px", fontWeight: 700, marginBottom: "10px" }}>Almost there — connect Supabase</div>
      <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.6 }}>
        Add your project URL and anon key to the <code style={{ color: C.accent }}>.env</code> file, then restart the dev server.
        See <code style={{ color: C.accent }}>.env.example</code> for the format.
      </div>
    </Centered>
  );

  if (loading) return <Centered><div style={{ color: C.sub, fontSize: "14px" }}>Loading…</div></Centered>;

  if (!session) return <Auth />;

  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke("delete-account");
    if (error) throw error;
    await supabase.auth.signOut();
  };

  return <Folio session={session} onSignOut={() => supabase.auth.signOut()} onDeleteAccount={deleteAccount} theme={theme} setTheme={setTheme} />;
}
