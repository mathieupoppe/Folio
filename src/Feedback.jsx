import { useState } from "react";
import { C } from "./theme";
import { supabase } from "./supabase";

// Reusable feedback form for both bug reports and feature/tool suggestions.
// kind: "bug" | "idea". Writes to the `feedback` Supabase table (see
// supabase/migrations/0002_feedback.sql). Degrades gracefully if the table
// isn't set up yet.
const COPY = {
  bug: {
    title: "Report a bug",
    blurb: "Something broken or behaving oddly? Tell us what happened and we'll fix it.",
    placeholder: "What went wrong? What were you doing when it happened?",
    cta: "Send bug report",
    thanks: "Thanks — your report was sent. We're on it.",
  },
  idea: {
    title: "Suggest a feature",
    blurb: "Want a new tool or a feature? We read every idea — the best ones get built.",
    placeholder: "Describe the tool or feature you'd love to see, and why it'd help.",
    cta: "Send suggestion",
    thanks: "Thanks — your idea was sent. Keep them coming!",
  },
};

const input = { width: "100%", padding: "12px 14px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "14px", outline: "none", color: C.text, fontFamily: "inherit" };

export default function Feedback({ kind = "bug", userId }) {
  const t = COPY[kind] || COPY.bug;
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const [errMsg, setErrMsg] = useState("");

  const submit = async () => {
    const msg = message.trim();
    if (!msg) return;
    setStatus("sending"); setErrMsg("");
    try {
      const { error } = await supabase.from("feedback").insert({
        user_id: userId || null,
        kind,
        message: msg,
        contact: contact.trim() || null,
        meta: { ua: navigator.userAgent, path: location.pathname, at: new Date().toISOString() },
      });
      if (error) throw error;
      setStatus("done"); setMessage(""); setContact("");
    } catch (e) {
      // Most likely the feedback table/policy isn't set up yet.
      const missing = /relation .*feedback.* does not exist|schema cache|not find the table/i.test(e?.message || "");
      setErrMsg(missing
        ? "Feedback isn't switched on yet — the `feedback` table needs to be created in Supabase (see supabase/migrations/0002_feedback.sql)."
        : (e?.message || "Couldn't send right now. Please try again."));
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div style={{ background: C.cardGrad, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.4rem 1.2rem", textAlign: "center" }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", margin: "0 auto 12px", background: C.up + "22", color: C.up, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.up} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </div>
        <div style={{ fontSize: "14px", color: C.text, fontWeight: 600, marginBottom: "4px" }}>{t.thanks}</div>
        <button onClick={() => setStatus("idle")} style={{ marginTop: "10px", padding: "9px 16px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.sub, fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>Send another</button>
      </div>
    );
  }

  return (
    <div style={{ background: C.cardGrad, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.05rem 1.15rem" }}>
      <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.55, marginBottom: "14px" }}>{t.blurb}</div>
      <textarea
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder={t.placeholder}
        rows={5}
        aria-label={t.title}
        style={{ ...input, resize: "vertical", minHeight: "110px", lineHeight: 1.5, marginBottom: "10px" }}
      />
      <input
        value={contact}
        onChange={e => setContact(e.target.value)}
        placeholder="Email to follow up (optional)"
        aria-label="Contact email (optional)"
        style={{ ...input, marginBottom: "12px" }}
      />
      {status === "error" && <div style={{ fontSize: "12px", color: C.down, marginBottom: "10px", lineHeight: 1.5 }}>{errMsg}</div>}
      <button
        onClick={submit}
        disabled={status === "sending" || !message.trim()}
        style={{
          width: "100%", padding: "13px", borderRadius: "12px", border: "none",
          background: (status === "sending" || !message.trim()) ? C.surface : C.accentGrad,
          boxShadow: (status === "sending" || !message.trim()) ? "none" : C.glow,
          color: (status === "sending" || !message.trim()) ? C.sub : "#fff",
          fontWeight: 700, fontSize: "14px", cursor: (status === "sending" || !message.trim()) ? "default" : "pointer",
        }}
      >
        {status === "sending" ? "Sending…" : t.cta}
      </button>
    </div>
  );
}
