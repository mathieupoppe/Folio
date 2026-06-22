import { useEffect, useRef, useState } from "react";
import { C } from "./theme";
import { getConversations, getThread, sendMessage, markThreadRead, searchProfiles, getProfile } from "./social";

const nameOf = p => p?.display_name?.trim() || (p?.handle ? "@" + p.handle : "Someone");
const initOf = p => (p?.display_name?.[0] || p?.handle?.[0] || "?").toUpperCase();
function timeAgo(iso) { const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); if (s < 60) return "now"; if (s < 3600) return Math.floor(s / 60) + "m"; if (s < 86400) return Math.floor(s / 3600) + "h"; return Math.floor(s / 86400) + "d"; }

function Avatar({ p, size = 44 }) {
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4 + "px", fontWeight: 700, color: C.text, flexShrink: 0 }}>{initOf(p)}</span>;
}

// Mini shared-post card inside a chat bubble.
function SharedPost({ post, onOpen, light }) {
  if (!post) return <span style={{ fontStyle: "italic", opacity: 0.7 }}>[post unavailable]</span>;
  return (
    <button onClick={onOpen} style={{ display: "flex", flexDirection: "column", gap: "6px", background: light ? "rgba(255,255,255,0.12)" : C.card, border: "0.5px solid " + C.border, borderRadius: "12px", overflow: "hidden", cursor: "pointer", padding: 0, width: 200, textAlign: "left" }}>
      {post.image_url
        ? <img src={post.image_url} alt="" style={{ width: "100%", height: 120, objectFit: "cover" }} />
        : <div style={{ width: "100%", minHeight: 70, padding: "12px", fontSize: "12px", color: light ? "#fff" : C.text, lineHeight: 1.4 }}>{post.caption}</div>}
      <div style={{ padding: post.image_url ? "0 10px 9px" : "0 10px 9px", fontSize: "11px", color: light ? "rgba(255,255,255,0.85)" : C.hint }}>
        {post.image_url && post.caption ? post.caption.slice(0, 60) : `@${post.author?.handle || "post"}`}
      </div>
    </button>
  );
}

// ── A single conversation thread ──────────────────────────────────────────────
function Thread({ currentUserId, other, onBack, onOpenPost }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);
  const load = async () => { const t = await getThread(currentUserId, other.id); setMsgs(t); markThreadRead(currentUserId, other.id).catch(() => {}); };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [other.id]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [msgs]);

  const send = async () => {
    const body = text.trim(); if (!body || busy) return;
    setBusy(true); setText("");
    try { await sendMessage(currentUserId, other.id, { body }); await load(); }
    catch (e) { window.alert("Couldn't send: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div className="ffade" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", paddingBottom: "12px", borderBottom: "0.5px solid " + C.border }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, fontSize: "20px", cursor: "pointer", padding: 0 }}>‹</button>
        <Avatar p={other} size={34} />
        <span style={{ fontSize: "15px", fontWeight: 800, color: C.text }}>{nameOf(other)}</span>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", padding: "12px 2px" }}>
        {msgs === null ? <div style={{ color: C.hint, fontSize: "13px", textAlign: "center", padding: "20px" }}>Loading…</div>
          : msgs.length === 0 ? <div style={{ color: C.hint, fontSize: "13px", textAlign: "center", padding: "30px", lineHeight: 1.6 }}>No messages yet.<br />Say hi 👋</div>
          : msgs.map(m => {
            const mine = m.sender_id === currentUserId;
            return (
              <div key={m.id} style={{ alignSelf: mine ? "flex-end" : "flex-start", maxWidth: "80%" }}>
                <div style={{ padding: m.post ? "6px" : "9px 12px", borderRadius: "16px", background: mine ? C.accent : C.surface, color: mine ? C.onAccent : C.text, border: mine ? "none" : "0.5px solid " + C.border, fontSize: "13px", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {m.post && <div style={{ marginBottom: m.body ? "6px" : 0 }}><SharedPost post={m.post} light={mine} onOpen={() => onOpenPost?.({ id: m.post.id, author: nameOf(m.post.author), handle: "@" + (m.post.author?.handle || ""), initial: initOf(m.post.author), kind: m.post.image_url ? "photo" : "text", caption: m.post.caption, image: m.post.image_url, media: null })} /></div>}
                  {m.body}
                </div>
                <div style={{ fontSize: "10px", color: C.hint, textAlign: mine ? "right" : "left", marginTop: "2px" }}>{timeAgo(m.created_at)}</div>
              </div>
            );
          })}
      </div>
      <div style={{ display: "flex", gap: "8px", paddingTop: "8px", borderTop: "0.5px solid " + C.border }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder="Message…" style={{ flex: 1, padding: "11px 13px", borderRadius: "22px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", outline: "none" }} />
        <button onClick={send} disabled={!text.trim() || busy} aria-label="Send" style={{ width: 44, borderRadius: "50%", border: "none", background: text.trim() ? C.accent : C.surface, color: text.trim() ? C.onAccent : C.hint, fontWeight: 700, fontSize: "16px", cursor: text.trim() ? "pointer" : "default" }}>↑</button>
      </div>
    </div>
  );
}

// ── Messages tab: conversation list + new-message search + thread ─────────────
export default function Messages({ currentUserId, startUser, onConsumeStart, onOpenPost }) {
  const [convos, setConvos] = useState(null);
  const [active, setActive] = useState(null); // the "other" profile
  const [newMode, setNewMode] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);

  const load = () => getConversations(currentUserId).then(setConvos).catch(() => setConvos([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentUserId]);

  // External entry (e.g. "Message" from a profile) opens that thread.
  useEffect(() => { if (startUser) { setActive(startUser); onConsumeStart?.(); } }, [startUser, onConsumeStart]);

  useEffect(() => {
    const t = setTimeout(async () => { const term = q.trim(); if (term.length < 2) { setResults([]); return; } try { setResults(await searchProfiles(term)); } catch { setResults([]); } }, 300);
    return () => clearTimeout(t);
  }, [q]);

  if (active) return <Thread currentUserId={currentUserId} other={active} onBack={() => { setActive(null); load(); }} onOpenPost={onOpenPost} />;

  return (
    <div className="ffade">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
        <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>Messages</span>
        <button onClick={() => setNewMode(v => !v)} style={{ background: newMode ? C.accent : C.surface, border: "0.5px solid " + (newMode ? C.accent : C.border), borderRadius: "999px", padding: "7px 13px", color: newMode ? C.onAccent : C.text, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{newMode ? "Cancel" : "✎ New"}</button>
      </div>

      {newMode && (
        <div style={{ marginBottom: "14px" }}>
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search people to message…" style={{ width: "100%", padding: "11px 13px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "8px" }} />
          {results.map(p => (
            <button key={p.id} onClick={() => { setActive(p); setNewMode(false); setQ(""); }} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "9px 4px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
              <Avatar p={p} size={38} />
              <span><span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: C.text }}>{nameOf(p)}</span><span style={{ fontSize: "12px", color: C.hint }}>@{p.handle}</span></span>
            </button>
          ))}
        </div>
      )}

      {convos === null ? <div style={{ color: C.hint, fontSize: "13px", textAlign: "center", padding: "20px" }}>Loading…</div>
        : convos.length === 0 && !newMode ? <div style={{ textAlign: "center", color: C.hint, fontSize: "13px", padding: "40px 16px", lineHeight: 1.6 }}>No conversations yet.<br />Tap <strong style={{ color: C.text }}>✎ New</strong> to message someone, or share a post into a chat.</div>
        : convos.map(c => (
          <button key={c.otherId} onClick={() => setActive(c.other)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "11px 4px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
            <Avatar p={c.other} size={48} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: C.text }}>{nameOf(c.other)}</span>
                <span style={{ fontSize: "11px", color: C.hint }}>{timeAgo(c.last.created_at)}</span>
              </span>
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", color: c.unread ? C.text : C.hint, fontWeight: c.unread ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.last.sender_id === currentUserId ? "You: " : ""}{c.last.post ? "📎 Shared a post" : c.last.body}
                </span>
                {c.unread > 0 && <span style={{ flexShrink: 0, minWidth: 18, height: 18, borderRadius: "9px", background: C.accent, color: C.onAccent, fontSize: "10px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{c.unread}</span>}
              </span>
            </span>
          </button>
        ))}
    </div>
  );
}

// ── Share sheet: send a post into a chat, or share externally ─────────────────
export function ShareSheet({ post, currentUserId, onClose, onSent }) {
  const [convos, setConvos] = useState([]);
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [sentTo, setSentTo] = useState(null);
  if (!post) return null;

  useEffect(() => { getConversations(currentUserId).then(setConvos).catch(() => setConvos([])); }, [currentUserId]);
  useEffect(() => {
    const t = setTimeout(async () => { const term = q.trim(); if (term.length < 2) { setResults([]); return; } try { setResults((await searchProfiles(term)).filter(p => p.id !== currentUserId)); } catch { setResults([]); } }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const sendTo = async (p) => {
    try { await sendMessage(currentUserId, p.id, { postId: post.id, body: null }); setSentTo(nameOf(p)); onSent?.(); setTimeout(onClose, 900); }
    catch (e) { window.alert("Couldn't share: " + (e?.message || e)); }
  };
  const external = () => {
    const url = `${location.origin}${location.pathname}?post=${post.id}`;
    if (navigator.share) navigator.share({ title: "Folio", text: post.caption || "Check out this post on Folio", url }).catch(() => {});
    else { navigator.clipboard?.writeText(url); window.alert("Link copied — paste it anywhere."); }
    onClose();
  };
  const people = [...convos.map(c => c.other), ...results.filter(r => !convos.some(c => c.otherId === r.id))];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 97, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} className="ffade" style={{ width: "100%", maxWidth: 460, background: C.card, borderTopLeftRadius: "22px", borderTopRightRadius: "22px", border: "0.5px solid " + C.border, padding: "16px 16px calc(16px + env(safe-area-inset-bottom))", maxHeight: "75vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 14px" }} />
        {sentTo ? (
          <div style={{ textAlign: "center", padding: "20px", fontSize: "14px", color: C.text }}>✓ Sent to {sentTo}</div>
        ) : <>
          <div style={{ fontSize: "15px", fontWeight: 800, color: C.text, marginBottom: "12px" }}>Share post</div>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search people…" style={{ width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", outline: "none", boxSizing: "border-box", marginBottom: "10px" }} />
          <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.hint, marginBottom: "6px" }}>Send in chat</div>
          {people.length ? people.map(p => (
            <button key={p.id} onClick={() => sendTo(p)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "9px 4px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
              <Avatar p={p} size={38} />
              <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: "14px", fontWeight: 600, color: C.text }}>{nameOf(p)}</span><span style={{ fontSize: "11px", color: C.hint }}>@{p.handle}</span></span>
              <span style={{ fontSize: "12px", fontWeight: 700, color: C.accent }}>Send</span>
            </button>
          )) : <div style={{ fontSize: "12px", color: C.hint, padding: "6px 0 12px" }}>Search above to find someone to send this to.</div>}
          <button onClick={external} style={{ width: "100%", marginTop: "14px", padding: "12px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "14px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
            Share to another app
          </button>
        </>}
      </div>
    </div>
  );
}
