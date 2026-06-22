import { useEffect, useState } from "react";
import { C } from "./theme";
import { PostView } from "./Saved";
import Comments from "./Comments";
import { searchProfiles, getProfile, getUserPosts, isFollowing, follow, unfollow, blockUser } from "./social";

// Discover people + view a public profile and follow/unfollow them.
// Self-fetching; call onFollowChanged after follow/unfollow so the home feed refreshes.

function Avatar({ p, size = 44 }) {
  const init = (p?.display_name?.[0] || p?.handle?.[0] || "?").toUpperCase();
  return p?.avatar_url
    ? <img src={p.avatar_url} alt="" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
    : <span style={{ width: size, height: size, borderRadius: "50%", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.4 + "px", fontWeight: 700, color: C.text, flexShrink: 0 }}>{init}</span>;
}
const nameOf = p => p?.display_name?.trim() || (p?.handle ? "@" + p.handle : "Someone");

// ── Public profile (read-only, with Follow) ──────────────────────────────────
export function PublicProfile({ userId, currentUserId, onBack, onFollowChanged, onMessage, onReport }) {
  const [prof, setProf] = useState(null);
  const [posts, setPosts] = useState([]);
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(null);
  const [menu, setMenu] = useState(false);
  const isSelf = userId === currentUserId;

  const block = async () => {
    setMenu(false);
    if (!window.confirm(`Block @${prof.handle}? They'll disappear from your feed and search, and you'll unfollow each other.`)) return;
    try { await blockUser(currentUserId, userId); if (following) { await unfollow(currentUserId, userId); } onFollowChanged?.(); onBack?.(); }
    catch (e) { window.alert("Couldn't block: " + (e?.message || e)); }
  };

  useEffect(() => {
    let on = true;
    (async () => {
      try {
        const [p, ps, f] = await Promise.all([getProfile(userId), getUserPosts(userId), isSelf ? Promise.resolve(false) : isFollowing(currentUserId, userId)]);
        if (!on) return; setProf(p); setPosts(ps); setFollowing(f);
      } catch { /* ignore */ }
    })();
    return () => { on = false; };
  }, [userId, currentUserId, isSelf]);

  const toggle = async () => {
    if (busy) return; setBusy(true);
    const was = following; setFollowing(!was);
    setProf(p => p ? { ...p, followers_count: Math.max(0, (p.followers_count || 0) + (was ? -1 : 1)) } : p);
    try { was ? await unfollow(currentUserId, userId) : await follow(currentUserId, userId); onFollowChanged?.(); }
    catch (e) { setFollowing(was); window.alert("Couldn't update: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  if (!prof) return <div style={{ color: C.hint, fontSize: "13px", padding: "30px", textAlign: "center" }}>Loading…</div>;
  const Stat = ({ n, l }) => <div style={{ flex: 1, textAlign: "center" }}><div className="tnum" style={{ fontSize: "18px", fontWeight: 800, color: C.text }}>{n}</div><div style={{ fontSize: "11px", color: C.hint }}>{l}</div></div>;

  return (
    <div className="ffade">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: "12px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, fontSize: "14px", fontWeight: 600, cursor: "pointer", padding: 0 }}>← Back</button>
        {!isSelf && (
          <div style={{ position: "relative" }}>
            <button onClick={() => setMenu(m => !m)} aria-label="More" style={{ background: "none", border: "none", color: C.text, cursor: "pointer", padding: "2px 6px", fontSize: "20px", lineHeight: 1 }}>⋯</button>
            {menu && (
              <>
                <div onClick={() => setMenu(false)} style={{ position: "fixed", inset: 0, zIndex: 20 }} />
                <div style={{ position: "absolute", right: 0, top: "28px", zIndex: 21, background: C.card, border: "0.5px solid " + C.border, borderRadius: "12px", overflow: "hidden", minWidth: 160, boxShadow: "0 10px 30px -12px rgba(0,0,0,0.5)" }}>
                  <button onClick={() => { setMenu(false); onReport?.({ userId, handle: prof.handle }); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, color: C.text, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Report account</button>
                  <button onClick={block} style={{ display: "block", width: "100%", textAlign: "left", padding: "11px 14px", background: "none", border: "none", color: C.down, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Block</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <div style={{ fontSize: "17px", fontWeight: 800, color: C.text, marginBottom: "14px" }}>{prof.handle ? "@" + prof.handle : "Profile"}</div>
      <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "14px" }}>
        <Avatar p={prof} size={82} />
        <div style={{ display: "flex", flex: 1 }}>
          <Stat n={posts.length} l="Posts" /><Stat n={prof.followers_count || 0} l="Followers" /><Stat n={prof.following_count || 0} l="Following" />
        </div>
      </div>
      <div style={{ fontSize: "14px", fontWeight: 800, color: C.text }}>{nameOf(prof)}</div>
      {prof.bio && <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.5, marginTop: "3px", whiteSpace: "pre-line" }}>{prof.bio}</div>}
      {!isSelf && (
        <div style={{ display: "flex", gap: "8px", marginTop: "14px", marginBottom: "18px" }}>
          <button onClick={toggle} disabled={busy} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: following ? "0.5px solid " + C.border : "none", background: following ? C.surface : C.accent, color: following ? C.text : C.onAccent, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>{following ? "Following ✓" : "Follow"}</button>
          <button onClick={() => onMessage?.(prof)} style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Message</button>
        </div>
      )}
      {posts.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3px", marginTop: isSelf ? "16px" : 0 }}>
          {posts.map(p => (
            <button key={p.id} onClick={() => setView({ id: p.id, author: nameOf(prof), handle: "@" + prof.handle, initial: (prof.display_name?.[0] || prof.handle?.[0] || "?").toUpperCase(), kind: p.image_url ? "photo" : "text", caption: p.caption, image: p.image_url, media: null })} style={{ aspectRatio: "1 / 1", background: `linear-gradient(150deg, ${C.surface}, ${C.card})`, border: "0.5px solid " + C.border, cursor: "pointer", overflow: "hidden", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {p.image_url ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: "11px", color: C.sub, padding: "8px", lineHeight: 1.4, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.caption}</span>}
            </button>
          ))}
        </div>
      ) : <div style={{ textAlign: "center", color: C.hint, fontSize: "13px", padding: "24px" }}>No posts yet.</div>}
      <PostView snap={view} onClose={() => setView(null)} onReport={isSelf ? undefined : (s) => onReport?.({ postId: s.id })} commentsSlot={view && <Comments postId={view.id} currentUserId={currentUserId} allowReplies />} />
    </div>
  );
}

// ── Search people ─────────────────────────────────────────────────────────────
export function Discover({ currentUserId, onOpenUser, onBack }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => {
      const term = q.trim();
      if (term.length < 2) { setResults([]); setSearched(false); return; }
      try { setResults(await searchProfiles(term)); setSearched(true); } catch { setResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="ffade">
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
        <button onClick={onBack} style={{ background: "none", border: "none", color: C.accent, fontSize: "14px", fontWeight: 600, cursor: "pointer", padding: 0 }}>← Feed</button>
        <span style={{ fontSize: "17px", fontWeight: 800, color: C.text }}>Discover people</span>
      </div>
      <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or @handle…" style={{ width: "100%", padding: "12px 14px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "14px", outline: "none", boxSizing: "border-box", marginBottom: "12px" }} />
      {results.map(p => (
        <button key={p.id} onClick={() => onOpenUser(p.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "10px 4px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
          <Avatar p={p} size={42} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: C.text }}>{nameOf(p)}</span>
            <span style={{ fontSize: "12px", color: C.hint }}>@{p.handle} · {p.followers_count || 0} followers</span>
          </span>
          <span style={{ color: C.hint, fontSize: "16px" }}>›</span>
        </button>
      ))}
      {q.trim().length >= 2 && searched && results.length === 0 && <div style={{ textAlign: "center", color: C.hint, fontSize: "13px", padding: "24px" }}>No one found for "{q}".</div>}
      {q.trim().length < 2 && <div style={{ textAlign: "center", color: C.hint, fontSize: "13px", padding: "24px", lineHeight: 1.6 }}>Type at least 2 letters to find people by name or @handle.</div>}
    </div>
  );
}
