import { useState, useMemo } from "react";
import { C } from "./theme";
import { supabase } from "./supabase";
import { generateInsights, insightsHeadline } from "./lib/insights";

// Maps an insight severity to a color + glyph.
const SEV = {
  good:   { color: "#3dd68c", icon: "M20 6 9 17l-5-5" },
  watch:  { color: "#f0a23c", icon: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
  action: { color: "#f05c5c", icon: "M12 8v4M12 16h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" },
};

function SevIcon({ severity }) {
  const s = SEV[severity] || SEV.watch;
  return (
    <span style={{ width: 30, height: 30, borderRadius: "9px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: s.color + "22", color: s.color }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={s.color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d={s.icon} /></svg>
    </span>
  );
}

function InsightRow({ title, detail, severity }) {
  return (
    <div style={{ display: "flex", gap: "11px", padding: "11px 0", borderTop: "0.5px solid " + C.border }}>
      <SevIcon severity={severity} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: C.text, marginBottom: "2px" }}>{title}</div>
        <div style={{ fontSize: "12px", color: C.sub, lineHeight: 1.5 }}>{detail}</div>
      </div>
    </div>
  );
}

const card = { background: C.cardGrad, borderRadius: "18px", border: "0.5px solid " + C.border, boxShadow: C.shadow + ", " + C.hi, padding: "1.05rem 1.15rem", marginBottom: "12px" };

// Sparkle glyph — the coach's signature mark.
function Sparkle({ size = 18, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 4.8L18.7 9.7l-4.8 1.9L12 16.4l-1.9-4.8L5.3 9.7l4.8-1.9z" />
      <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </svg>
  );
}

export default function Advisor({ data }) {
  const insights = useMemo(() => generateInsights(data), [data]);
  const headline = useMemo(() => insightsHeadline(insights), [insights]);

  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [ai, setAi] = useState(null);
  const [errMsg, setErrMsg] = useState("");

  const runAI = async () => {
    setStatus("loading"); setErrMsg(""); setAi(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("advisor", { body: data });
      if (error) throw error;
      if (res?.error) {
        setErrMsg(res.message || (res.error === "not_configured"
          ? "The AI coach isn't switched on yet. Add your Anthropic API key on the server to enable it."
          : "Something went wrong analyzing your finances."));
        setStatus("error");
        return;
      }
      setAi(res.result);
      setStatus("done");
    } catch (e) {
      // FunctionsFetchError = the edge function can't be reached (not deployed, or offline).
      const notReachable = e?.name === "FunctionsFetchError" || /failed to send|fetch/i.test(e?.message || "");
      setErrMsg(notReachable
        ? "Couldn't reach the AI coach. If the advisor function isn't deployed to your Supabase project yet, deploy it first — otherwise check your connection and try again."
        : (e?.message || "Something went wrong. Please try again."));
      setStatus("error");
    }
  };

  const accentGrad = `linear-gradient(135deg, ${C.accent}, ${C.accentD})`;

  return (
    <>
      {/* Hero */}
      <div style={{ ...card, background: accentGrad, border: "none", color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ width: 34, height: 34, borderRadius: "10px", background: "rgba(255,255,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkle size={18} />
          </span>
          <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.01em" }}>Your money coach</div>
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.5, opacity: 0.95 }}>{headline}</div>
      </div>

      {/* Instant, on-device insights */}
      <div style={card}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint, marginBottom: "2px" }}>What stands out</div>
        <div style={{ fontSize: "11px", color: C.hint, marginBottom: "4px" }}>Spotted instantly from your plan.</div>
        {insights.map(i => <InsightRow key={i.id} title={i.title} detail={i.detail} severity={i.severity} />)}
      </div>

      {/* Deep AI analysis */}
      <div style={card}>
        {status !== "done" && (
          <>
            <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.5, marginBottom: "12px" }}>
              Want a deeper read? Folio's AI coach reviews your whole picture and writes a personalized analysis.
            </div>
            <button onClick={runAI} disabled={status === "loading"} style={{
              width: "100%", padding: "13px", borderRadius: "12px", border: "none", background: status === "loading" ? C.surface : accentGrad,
              color: status === "loading" ? C.sub : "#fff", fontWeight: 700, fontSize: "14px", cursor: status === "loading" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {status === "loading"
                ? <><span className="fspin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid " + C.border, borderTopColor: C.sub, display: "inline-block" }} /> Analyzing your finances…</>
                : <><Sparkle size={16} color="#fff" /> Get my AI analysis</>}
            </button>
          </>
        )}

        {status === "error" && (
          <div style={{ fontSize: "12px", color: C.down, marginTop: "12px", lineHeight: 1.5 }}>{errMsg}</div>
        )}

        {status === "done" && ai && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
              <Sparkle size={16} color={C.accent} />
              <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent }}>AI analysis</div>
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: C.text, lineHeight: 1.5, marginBottom: "6px" }}>{ai.headline}</div>
            {Array.isArray(ai.insights) && ai.insights.map((i, idx) => (
              <InsightRow key={idx} title={i.title} detail={i.detail} severity={i.severity} />
            ))}
            {ai.nextStep && (
              <div style={{ marginTop: "12px", padding: "12px 14px", borderRadius: "12px", background: C.accent + "14", border: "0.5px solid " + C.accent + "44" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.accent, marginBottom: "4px" }}>Do this next</div>
                <div style={{ fontSize: "13px", color: C.text, lineHeight: 1.5 }}>{ai.nextStep}</div>
              </div>
            )}
            <button onClick={runAI} style={{ width: "100%", marginTop: "12px", padding: "11px", borderRadius: "11px", border: "0.5px solid " + C.border, background: C.surface, color: C.sub, fontWeight: 600, fontSize: "13px", cursor: "pointer" }}>
              Re-analyze
            </button>
            <div style={{ fontSize: "10px", color: C.hint, marginTop: "10px", lineHeight: 1.4 }}>
              General educational guidance from AI, not regulated financial advice.
            </div>
          </>
        )}
      </div>
    </>
  );
}
