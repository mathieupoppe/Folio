import { useState } from "react";
import { C } from "./theme";
import { SaveSheet, PostView } from "./Saved";
import Comments from "./Comments";
import { SEED_POSTS, SEED_STORIES, creatorById, postsByCreator } from "./seed";

// ─────────────────────────────────────────────────────────────────────────────
// Social feed — "Instagram for finance". A new user with zero follows still
// lands on a curated starter feed (see seed.js) so it never feels empty. Real
// posts from people you follow are rendered first, the seed set fills the rest.
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLE_STORIES = [{ id: "you", name: "Your story", initial: "+", you: true }, ...SEED_STORIES];
const SAMPLE_POSTS = SEED_POSTS;

function Avatar({ initial, size = 38, ring = false, you = false }) {
  return (
    <div style={{ padding: ring ? 2 : 0, borderRadius: "50%", background: ring ? `linear-gradient(135deg, ${C.text}, ${C.sub})` : "transparent", flexShrink: 0 }}>
      <div style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: you ? "transparent" : C.surface,
        border: "1.5px solid " + (you ? C.accent : C.border),
        color: you ? C.accent : C.text,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontWeight: 700, fontSize: size * 0.42 + "px", textTransform: "uppercase",
      }}>{initial}</div>
    </div>
  );
}

function StoriesRow({ onOpenProfile }) {
  return (
    <div style={{ display: "flex", gap: "14px", overflowX: "auto", padding: "4px 2px 14px", WebkitOverflowScrolling: "touch" }} className="noscroll">
      {SAMPLE_STORIES.map(s => (
        <button key={s.id} onClick={() => !s.you && onOpenProfile?.(s)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", flexShrink: 0, padding: 0 }}>
          <Avatar initial={s.initial} size={56} ring={!s.you} you={s.you} />
          <span style={{ fontSize: "10px", color: C.sub, maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
        </button>
      ))}
    </div>
  );
}

function PostMedia({ media, kind }) {
  const trendCol = media.trend === "up" ? C.up : media.trend === "down" ? C.down : C.text;
  const big = kind === "video" ? "16:9" : "1.1";
  return (
    <div style={{ position: "relative", width: "100%", aspectRatio: kind === "video" ? "16 / 10" : "4 / 3", background: `linear-gradient(150deg, ${C.surface}, ${C.card})`, borderTop: "0.5px solid " + C.border, borderBottom: "0.5px solid " + C.border, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "8px", padding: "20px", textAlign: "center", overflow: "hidden" }}>
      <div style={{ fontSize: kind === "video" ? "44px" : "40px", fontWeight: 800, letterSpacing: "-0.02em", color: media.trend ? trendCol : C.text, lineHeight: 1 }}>{media.big}</div>
      {media.sub && <div style={{ fontSize: "13px", color: C.sub, whiteSpace: "pre-line", maxWidth: 320, lineHeight: 1.45 }}>{media.sub}</div>}
      {kind === "video" && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{ width: 54, height: 54, borderRadius: "50%", background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)", border: "1.5px solid rgba(255,255,255,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><polygon points="6 4 20 12 6 20" /></svg>
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onOpenProfile, onSaveOpen, onView, saved, onShare }) {
  const [liked, setLiked] = useState(false);
  const likeCount = post.likes + (liked ? 1 : 0);
  const snap = { id: post.id, author: post.author, handle: post.handle, initial: post.initial, time: post.time, tag: post.tag, kind: post.kind, caption: post.caption, image: null, media: post.media };
  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: "18px", overflow: "hidden", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px" }}>
        <button onClick={() => onOpenProfile?.(post)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", padding: 0, minWidth: 0 }}>
          <Avatar initial={post.initial} size={38} />
          <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", minWidth: 0 }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{post.author}</span>
            <span style={{ fontSize: "11px", color: C.hint }}>{post.time} · {post.tag}</span>
          </span>
        </button>
      </div>
      <div onClick={() => onView?.(snap)} style={{ cursor: "pointer" }}><PostMedia media={post.media} kind={post.kind} /></div>
      <div style={{ padding: "10px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "8px" }}>
          <button onClick={() => setLiked(v => !v)} aria-label="Like" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: liked ? C.down : C.text, display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? C.down : "none"} stroke={liked ? C.down : C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            {likeCount.toLocaleString()}
          </button>
          <button onClick={() => onView?.(snap)} aria-label="Comments" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.text, display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.2-5.4A8.4 8.4 0 1 1 21 11.5z" /></svg>
            {post.comments}
          </button>
          <button onClick={() => onShare?.(snap)} aria-label="Share" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto", color: C.text }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
          </button>
          <button onClick={() => onSaveOpen?.(snap)} aria-label="Save" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: saved ? C.accent : C.text }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill={saved ? C.accent : "none"} stroke={saved ? C.accent : C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>
        <div style={{ fontSize: "13px", color: C.text, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 700 }}>{post.author}</span> {post.caption}
        </div>
        {post.comments > 0 && <button style={{ background: "none", border: "none", color: C.hint, fontSize: "12px", cursor: "pointer", padding: "8px 0 0" }}>View all {post.comments} comments</button>}
      </div>
    </div>
  );
}

// Render one of the user's own posts (caption + optional image) as a feed card.
function MyPostCard({ post, author, initial, onSaveOpen, onView, saved, liked, onToggleLike, onShare }) {
  const when = (() => { try { return new Date(post.createdAt).toLocaleDateString(); } catch { return ""; } })();
  const snap = { id: post.id, author, handle: "@" + author, initial, time: when, tag: "You", kind: post.image ? "photo" : "text", caption: post.caption, image: post.image || null, media: null };
  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: "18px", overflow: "hidden", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px" }}>
        <Avatar initial={initial} size={38} />
        <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <span style={{ fontSize: "13px", fontWeight: 700, color: C.text }}>{author}</span>
          <span style={{ fontSize: "11px", color: C.hint }}>{when} · You</span>
        </span>
      </div>
      {post.image && <img src={post.image} alt="" onClick={() => onView?.(snap)} style={{ width: "100%", maxHeight: 420, objectFit: "cover", borderTop: "0.5px solid " + C.border, borderBottom: "0.5px solid " + C.border, display: "block", cursor: "pointer" }} />}
      <div style={{ padding: "10px 14px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: post.caption ? "8px" : 0 }}>
          <button onClick={() => onToggleLike?.(post.id)} aria-label="Like" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: liked ? C.down : C.text, display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill={liked ? C.down : "none"} stroke={liked ? C.down : C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1L12 21l7.7-7.6 1.1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
            {post.like_count || 0}
          </button>
          <button onClick={() => onView?.(snap)} aria-label="Comments" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.text, display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: 600 }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-12.6 7.3L3 21l2.2-5.4A8.4 8.4 0 1 1 21 11.5z" /></svg>
            {post.comment_count || 0}
          </button>
          <button onClick={() => onShare?.(snap)} aria-label="Share" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginLeft: "auto", color: C.text }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
          </button>
          <button onClick={() => onSaveOpen?.(snap)} aria-label="Save" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: saved ? C.accent : C.text }}>
            <svg width="21" height="21" viewBox="0 0 24 24" fill={saved ? C.accent : "none"} stroke={saved ? C.accent : C.text} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
          </button>
        </div>
        {post.caption && <div onClick={() => onView?.(snap)} style={{ fontSize: "13px", color: C.text, lineHeight: 1.5, cursor: "pointer" }}><span style={{ fontWeight: 700 }}>{author}</span> {post.caption}</div>}
      </div>
    </div>
  );
}

// Read-only profile for a curated seed creator (tapped from a story or a post).
function SeedProfile({ creatorId, onClose, onView }) {
  const c = creatorById(creatorId);
  if (!c) return null;
  const posts = postsByCreator(creatorId);
  const Stat = ({ n, l }) => <div style={{ flex: 1, textAlign: "center" }}><div className="tnum" style={{ fontSize: "17px", fontWeight: 800, color: C.text }}>{n}</div><div style={{ fontSize: "11px", color: C.hint }}>{l}</div></div>;
  const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k" : "" + n;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 94, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} className="ffade" style={{ width: "100%", maxWidth: 440, maxHeight: "92vh", overflowY: "auto", background: C.bg, borderRadius: "20px 20px 0 0", borderTop: "0.5px solid " + C.border, padding: "16px 16px calc(20px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <span style={{ fontSize: "15px", fontWeight: 800, color: C.text }}>@{c.handle}</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: "20px", padding: "2px 4px" }}>✕</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "12px" }}>
          <Avatar initial={c.initial} size={72} />
          <div style={{ display: "flex", flex: 1 }}><Stat n={posts.length} l="Posts" /><Stat n={fmt(c.followers)} l="Followers" /><Stat n={fmt(Math.round(c.followers / 80))} l="Following" /></div>
        </div>
        <div style={{ fontSize: "14px", fontWeight: 800, color: C.text }}>{c.name}</div>
        <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.5, marginTop: "3px" }}>{c.bio}</div>
        <div style={{ display: "flex", gap: "8px", margin: "14px 0 16px" }}>
          <button disabled style={{ flex: 1, padding: "10px", borderRadius: "10px", border: "none", background: C.surface, color: C.hint, fontSize: "13px", fontWeight: 700, cursor: "default" }}>Following soon</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3px" }}>
          {posts.map(p => (
            <button key={p.id} onClick={() => { onView?.({ id: p.id, author: p.author, handle: p.handle, initial: p.initial, time: p.time, tag: p.tag, kind: p.kind, caption: p.caption, image: null, media: p.media }); }} style={{ aspectRatio: "1 / 1", background: `linear-gradient(150deg, ${C.surface}, ${C.card})`, border: "0.5px solid " + C.border, cursor: "pointer", overflow: "hidden", padding: "8px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px", textAlign: "center" }}>
              <span style={{ fontSize: "18px", fontWeight: 800, color: p.media?.trend === "up" ? C.up : p.media?.trend === "down" ? C.down : C.text, lineHeight: 1 }}>{p.media?.big}</span>
              {p.media?.sub && <span style={{ fontSize: "9px", color: C.hint, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", whiteSpace: "pre-line" }}>{p.media.sub}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Feed({ profile = {}, posts = [], email, playlists = [], onToggleSave, onCreatePlaylist, isSaved, currentUserId, allowReplies = true, likedIds, onToggleLike, onShare, onDiscover, onNotifs, onOpenProfile, onCompose }) {
  const myInitial = profile.first?.[0] || email?.[0] || "Y";
  const myName = (profile.first || profile.last) ? `${profile.first || ""} ${profile.last || ""}`.trim() : (profile.handle || "You");
  const [saveTarget, setSaveTarget] = useState(null); // snapshot being saved
  const [viewing, setViewing] = useState(null); // snapshot being zoomed
  const [seedProfile, setSeedProfile] = useState(null); // tapped seed creator id
  // A story/post author tap opens the seed profile if it's a curated creator,
  // otherwise falls through to the host (the user's own profile tab).
  const openAuthor = (t) => { const id = t?.id && creatorById(t.id) ? t.id : (creatorById(t?.author) ? t.author : null); id ? setSeedProfile(id) : onOpenProfile?.(t); };
  return (
    <div className="ffade">
      {/* header: title + discover people */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <span style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em", color: C.text }}>Feed</span>
        <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={onNotifs} aria-label="Notifications" style={{ width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface, border: "0.5px solid " + C.border, borderRadius: "50%", cursor: "pointer", color: C.text }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </button>
          <button onClick={onDiscover} aria-label="Discover people" style={{ display: "flex", alignItems: "center", gap: "6px", background: C.surface, border: "0.5px solid " + C.border, borderRadius: "999px", padding: "7px 13px", cursor: "pointer", color: C.text, fontSize: "12px", fontWeight: 700 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
            Discover
          </button>
        </span>
      </div>
      {/* composer */}
      <button onClick={onCompose} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", background: C.card, border: "0.5px solid " + C.border, borderRadius: "14px", padding: "11px 13px", marginBottom: "14px", cursor: "pointer", textAlign: "left" }}>
        <Avatar initial={myInitial} size={32} />
        <span style={{ fontSize: "13px", color: C.hint, flex: 1 }}>Share a win, a chart, or a money tip…</span>
        <span style={{ fontSize: "12px", fontWeight: 700, color: C.accent }}>Post</span>
      </button>

      <StoriesRow onOpenProfile={openAuthor} />

      {posts.map(p => <MyPostCard key={p.id} post={p} author={myName} initial={myInitial} onSaveOpen={setSaveTarget} onView={setViewing} saved={isSaved?.(p.id)} liked={likedIds?.has(p.id)} onToggleLike={onToggleLike} onShare={onShare} />)}
      {SAMPLE_POSTS.map(p => <PostCard key={p.id} post={p} onOpenProfile={openAuthor} onSaveOpen={setSaveTarget} onView={setViewing} saved={isSaved?.(p.id)} onShare={onShare} />)}

      <SaveSheet snap={saveTarget} playlists={playlists} onToggle={onToggleSave} onCreate={onCreatePlaylist} onClose={() => setSaveTarget(null)} />
      <PostView snap={viewing} onClose={() => setViewing(null)} commentsSlot={viewing && <Comments postId={viewing.id} currentUserId={currentUserId} allowReplies={allowReplies} />} />
      {seedProfile && <SeedProfile creatorId={seedProfile} onClose={() => setSeedProfile(null)} onView={setViewing} />}

      <div style={{ textAlign: "center", color: C.hint, fontSize: "12px", padding: "8px 0 4px", lineHeight: 1.6 }}>
        You're all caught up.<br />Real posts, profiles & following arrive when the social backend goes live.
      </div>
    </div>
  );
}
