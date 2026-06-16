import { useState, useMemo, useRef, useEffect } from "react";
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

  // ── Coach chat ──
  const [chat, setChat] = useState([]); // [{ role, content }]
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatErr, setChatErr] = useState("");
  const scrollRef = useRef(null);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [chat, chatBusy]);

  const sendChat = async (text) => {
    const q = (text ?? chatInput).trim();
    if (!q || chatBusy) return;
    const next = [...chat, { role: "user", content: q }];
    setChat(next); setChatInput(""); setChatErr(""); setChatBusy(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("advisor", { body: { messages: next, snapshot: data } });
      if (error) throw error;
      if (res?.error) {
        setChatErr(res.error === "not_configured"
          ? "The AI coach isn't switched on yet — deploy the advisor function and set your Anthropic key."
          : (res.message || "Something went wrong."));
        return;
      }
      setChat([...next, { role: "assistant", content: res.reply }]);
    } catch (e) {
      const notReachable = e?.name === "FunctionsFetchError" || /failed to send|fetch/i.test(e?.message || "");
      setChatErr(notReachable ? "Couldn't reach the AI coach. Deploy the advisor function first, then try again." : (e?.message || "Something went wrong."));
    } finally {
      setChatBusy(false);
    }
  };

  const STARTERS = ["Why is my health score what it is?", "How can I improve fastest?", "Am I saving enough?"];

  const accentGrad = `linear-gradient(135deg, ${C.accent}, ${C.accentD})`;

  return (
    <>
      {/* Hero */}
      <div style={{ ...card }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <span style={{ width: 34, height: 34, borderRadius: "10px", background: C.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkle size={18} color={C.onAccent} />
          </span>
          <div style={{ fontSize: "16px", fontWeight: 800, letterSpacing: "-0.01em", color: C.text }}>Your money coach</div>
        </div>
        <div style={{ fontSize: "13px", lineHeight: 1.5, color: C.sub }}>{headline}</div>
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
              color: status === "loading" ? C.sub : C.onAccent, fontWeight: 700, fontSize: "14px", cursor: status === "loading" ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
            }}>
              {status === "loading"
                ? <><span className="fspin" style={{ width: 16, height: 16, borderRadius: "50%", border: "2px solid " + C.border, borderTopColor: C.sub, display: "inline-block" }} /> Analyzing your finances…</>
                : <><Sparkle size={16} color={C.onAccent} /> Get my AI analysis</>}
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

      {/* Coach chat */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <Sparkle size={16} color={C.accent} />
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.accent }}>Ask your coach</div>
        </div>

        {chat.length === 0 ? (
          <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.5, marginBottom: "10px" }}>
            Ask anything about your money — your numbers are the context.
          </div>
        ) : (
          <div ref={scrollRef} style={{ maxHeight: "340px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
            {chat.map((m, i) => (
              <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%", padding: "9px 12px", borderRadius: "14px",
                background: m.role === "user" ? C.accent : C.surface, color: m.role === "user" ? C.onAccent : C.text,
                border: m.role === "user" ? "none" : "0.5px solid " + C.border, fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            ))}
            {chatBusy && (
              <div style={{ alignSelf: "flex-start", padding: "9px 12px", borderRadius: "14px", background: C.surface, border: "0.5px solid " + C.border, color: C.sub, fontSize: "13px" }}>
                <span className="fspin" style={{ width: 13, height: 13, borderRadius: "50%", border: "2px solid " + C.border, borderTopColor: C.sub, display: "inline-block", verticalAlign: "middle" }} /> thinking…
              </div>
            )}
          </div>
        )}

        {chat.length === 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "12px" }}>
            {STARTERS.map(s => (
              <button key={s} onClick={() => sendChat(s)} disabled={chatBusy} style={{ padding: "7px 11px", borderRadius: "999px", border: "0.5px solid " + C.border, background: C.surface, color: C.sub, fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: "8px" }}>
          <input
            value={chatInput}
            onChange={e => setChatInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
            placeholder="Ask your coach…"
            aria-label="Ask your coach a question"
            style={{ flex: 1, minWidth: 0, padding: "11px 13px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", outline: "none" }}
          />
          <button onClick={() => sendChat()} disabled={chatBusy || !chatInput.trim()} aria-label="Send" style={{
            flexShrink: 0, width: 44, borderRadius: "12px", border: "none", cursor: chatBusy || !chatInput.trim() ? "default" : "pointer",
            background: chatInput.trim() ? accentGrad : C.surface, color: chatInput.trim() ? C.onAccent : C.hint, fontWeight: 700, fontSize: "16px",
          }}>↑</button>
        </div>
        {chatErr && <div style={{ fontSize: "12px", color: C.down, marginTop: "8px", lineHeight: 1.5 }}>{chatErr}</div>}
      </div>
    </>
  );
}
