import { useEffect, useRef, useState } from "react";
import { C } from "./theme";
import { getComments, addComment, deleteComment } from "./social";

// Public comment thread under a post. Anyone can read; signed-in users can
// comment. Replies (one level) are shown indented and can be turned off by the
// post's author via Privacy settings (allowReplies).
const isReal = id => /^[0-9a-f]{8}-[0-9a-f]{4}/.test(String(id || ""));

function timeAgo(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "now";
  if (s < 3600) return Math.floor(s / 60) + "m";
  if (s < 86400) return Math.floor(s / 3600) + "h";
  return Math.floor(s / 86400) + "d";
}

function nameOf(a) { return a?.display_name?.trim() || (a?.handle ? "@" + a.handle : "Someone"); }
function initOf(a) { return (a?.display_name?.[0] || a?.handle?.[0] || "?").toUpperCase(); }

function Avatar({ a, size = 32 }) {
  return a?.avatar_url
    ? <img src={a.avatar_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4 + "px", fontWeight: 700, color: C.text, flexShrink: 0 }}>{initOf(a)}</span>;
}

function Row({ c, isReply, canReply, currentUserId, onReply, onDelete }) {
  return (
    <div style={{ display: "flex", gap: "9px", padding: "9px 0", paddingLeft: isReply ? "38px" : 0 }}>
      <Avatar a={c.author} size={isReply ? 26 : 32} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", color: C.text, lineHeight: 1.4 }}>
          <span style={{ fontWeight: 700 }}>{nameOf(c.author)}</span> {c.body}
        </div>
        <div style={{ display: "flex", gap: "14px", marginTop: "3px" }}>
          <span style={{ fontSize: "11px", color: C.hint }}>{timeAgo(c.created_at)}</span>
          {canReply && !isReply && <button onClick={() => onReply(c)} style={{ background: "none", border: "none", padding: 0, fontSize: "11px", fontWeight: 600, color: C.hint, cursor: "pointer" }}>Reply</button>}
          {c.author?.id === currentUserId && <button onClick={() => onDelete(c.id)} style={{ background: "none", border: "none", padding: 0, fontSize: "11px", fontWeight: 600, color: C.hint, cursor: "pointer" }}>Delete</button>}
        </div>
      </div>
    </div>
  );
}

export default function Comments({ postId, currentUserId, allowReplies = true }) {
  const [list, setList] = useState(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null); // a top-level comment being replied to
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const real = isReal(postId);

  const load = () => getComments(postId).then(setList).catch(() => setList([]));
  useEffect(() => { if (real) load(); else setList([]); /* eslint-disable-next-line */ }, [postId]);

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try { await addComment(postId, currentUserId, body, replyTo?.id || null); setText(""); setReplyTo(null); await load(); }
    catch (e) { window.alert("Couldn't post comment: " + (e?.message || e)); }
    finally { setBusy(false); }
  };
  const remove = async id => { try { await deleteComment(id); await load(); } catch (e) { window.alert("Couldn't delete: " + (e?.message || e)); } };
  const startReply = c => { setReplyTo(c); inputRef.current?.focus(); };

  if (!real) return (
    <div style={{ padding: "16px", fontSize: "12px", color: C.hint, textAlign: "center", lineHeight: 1.6 }}>
      Comments are available on real posts. This is a sample post.
    </div>
  );

  const total = list ? list.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0) : 0;

  return (
    <div style={{ borderTop: "0.5px solid " + C.border, padding: "10px 15px 15px" }}>
      <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.hint, marginBottom: "4px" }}>
        {list === null ? "Comments" : `${total} comment${total === 1 ? "" : "s"}`}
      </div>
      <div style={{ maxHeight: "40vh", overflowY: "auto" }}>
        {list === null ? <div style={{ fontSize: "13px", color: C.hint, padding: "10px 0" }}>Loading…</div>
          : list.length === 0 ? <div style={{ fontSize: "13px", color: C.hint, padding: "10px 0" }}>No comments yet. Be the first.</div>
          : list.map(c => (
            <div key={c.id}>
              <Row c={c} canReply={allowReplies} currentUserId={currentUserId} onReply={startReply} onDelete={remove} />
              {(c.replies || []).map(r => <Row key={r.id} c={r} isReply currentUserId={currentUserId} onDelete={remove} />)}
            </div>
          ))}
      </div>
      {replyTo && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: C.hint, padding: "6px 0" }}>
          <span>Replying to <strong style={{ color: C.text }}>{nameOf(replyTo.author)}</strong></span>
          <button onClick={() => setReplyTo(null)} style={{ background: "none", border: "none", color: C.hint, cursor: "pointer", fontSize: "11px" }}>✕</button>
        </div>
      )}
      <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
        <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === "Enter") send(); }} placeholder={replyTo ? "Write a reply…" : "Add a comment…"} style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", outline: "none" }} />
        <button disabled={!text.trim() || busy} onClick={send} style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: text.trim() && !busy ? C.accent : C.border, color: text.trim() && !busy ? C.onAccent : C.hint, fontSize: "13px", fontWeight: 700, cursor: text.trim() && !busy ? "pointer" : "default" }}>{busy ? "…" : "Post"}</button>
      </div>
    </div>
  );
}
