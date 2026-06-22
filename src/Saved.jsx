import { useState } from "react";
import { C } from "./theme";

// ─────────────────────────────────────────────────────────────────────────────
// Saved posts + playlists ("collections"). A saved item is a self-contained
// snapshot of a post so it renders even if the original scrolls away or the
// social backend isn't wired for that author yet. Playlists live in the user's
// synced data blob: playlists: [{ id, name, items: [snapshot] }].
// snapshot shape: { id, author, handle, initial, time, tag, kind, caption,
//                   image, media:{big,sub,trend} }
// ─────────────────────────────────────────────────────────────────────────────

function Avatar({ initial, size = 38 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: C.surface, border: "1.5px solid " + C.border, color: C.text, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: size * 0.42 + "px", textTransform: "uppercase" }}>{initial}</div>
  );
}

// Renders the "media" area of a post (image, finance-stat card, or video placeholder).
// `big` = zoomed view: upscale to fill the screen, contain (no crop/stretch).
function Media({ snap, big }) {
  if (snap.image) return <img src={snap.image} alt="" style={{ width: "100%", maxHeight: big ? "80vh" : "62vh", objectFit: "contain", background: "#000", borderTop: "0.5px solid " + C.border, borderBottom: "0.5px solid " + C.border, display: "block" }} />;
  if (snap.media) {
    const trendCol = snap.media.trend === "up" ? C.up : snap.media.trend === "down" ? C.down : C.text;
    return (
      <div style={{ position: "relative", width: "100%", minHeight: big ? "46vh" : undefined, aspectRatio: big ? undefined : (snap.kind === "video" ? "16 / 10" : "4 / 3"), background: `linear-gradient(150deg, ${C.surface}, ${C.card})`, borderTop: "0.5px solid " + C.border, borderBottom: "0.5px solid " + C.border, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: big ? "14px" : "8px", padding: big ? "48px 24px" : "20px", textAlign: "center" }}>
        <div style={{ fontSize: big ? "clamp(48px, 12vw, 92px)" : "40px", fontWeight: 800, letterSpacing: "-0.02em", color: snap.media.trend ? trendCol : C.text, lineHeight: 1 }}>{snap.media.big}</div>
        {snap.media.sub && <div style={{ fontSize: big ? "clamp(15px, 3.5vw, 20px)" : "13px", color: C.sub, whiteSpace: "pre-line", lineHeight: 1.45 }}>{snap.media.sub}</div>}
      </div>
    );
  }
  return null;
}

// Full-screen zoomed-in view of a single post (read-only). Pass `commentsSlot`
// (a rendered <Comments/>) to show the comment thread beneath the post.
export function PostView({ snap, onClose, commentsSlot }) {
  if (!snap) return null;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 95, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "max(12px, env(safe-area-inset-top)) 12px" }}>
      <div onClick={e => e.stopPropagation()} className="ffade" style={{ width: "min(96vw, 640px)", maxHeight: "94vh", overflowY: "auto", background: C.card, border: "0.5px solid " + C.border, borderRadius: "20px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "13px 15px" }}>
          <Avatar initial={snap.initial} size={40} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: C.text }}>{snap.author}</div>
            {(snap.time || snap.tag) && <div style={{ fontSize: "11px", color: C.hint }}>{[snap.time, snap.tag].filter(Boolean).join(" · ")}</div>}
          </div>
          {snap.id && <button onClick={() => {
            const url = `${location.origin}${location.pathname}?post=${snap.id}`;
            if (navigator.share) navigator.share({ title: "Folio", text: snap.caption || "Check out this post on Folio", url }).catch(() => {});
            else { navigator.clipboard?.writeText(url); window.alert("Link copied — share it anywhere."); }
          }} aria-label="Share" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", padding: "4px", marginRight: "2px" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 13.5 6.8 4M15.4 6.5 8.6 10.5" /></svg>
          </button>}
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: "20px", padding: "4px" }}>✕</button>
        </div>
        <Media snap={snap} big />
        {snap.caption && <div style={{ padding: "16px 18px", fontSize: "15px", color: C.text, lineHeight: 1.55 }}><span style={{ fontWeight: 700 }}>{snap.author}</span> {snap.caption}</div>}
        {commentsSlot}
      </div>
    </div>
  );
}

// Bottom sheet to save a post into one or more playlists (Instagram "collections").
export function SaveSheet({ snap, playlists, onToggle, onCreate, onClose }) {
  const [name, setName] = useState("");
  if (!snap) return null;
  const inPl = pl => pl.items.some(it => it.id === snap.id);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} className="ffade" style={{ width: "100%", maxWidth: 460, background: C.card, borderTopLeftRadius: "22px", borderTopRightRadius: "22px", border: "0.5px solid " + C.border, padding: "16px 16px calc(16px + env(safe-area-inset-bottom))", maxHeight: "70vh", overflowY: "auto" }}>
        <div style={{ width: 38, height: 4, borderRadius: 2, background: C.border, margin: "0 auto 14px" }} />
        <div style={{ fontSize: "15px", fontWeight: 800, color: C.text, marginBottom: "12px" }}>Save to playlist</div>
        {playlists.length === 0 && <div style={{ fontSize: "12px", color: C.hint, marginBottom: "10px" }}>No playlists yet — create one below to start organizing.</div>}
        {playlists.map(pl => (
          <button key={pl.id} onClick={() => onToggle(pl.id, snap)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "11px 4px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
            <span style={{ width: 38, height: 38, borderRadius: "10px", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}>🔖</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: "block", fontSize: "14px", fontWeight: 600, color: C.text }}>{pl.name}</span>
              <span style={{ fontSize: "11px", color: C.hint }}>{pl.items.length} saved</span>
            </span>
            <span style={{ width: 22, height: 22, borderRadius: "50%", border: "2px solid " + (inPl(pl) ? C.accent : C.border), background: inPl(pl) ? C.accent : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {inPl(pl) && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.onAccent} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
            </span>
          </button>
        ))}
        <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="New playlist name" style={{ flex: 1, padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", outline: "none" }} />
          <button disabled={!name.trim()} onClick={() => { const id = onCreate(name.trim()); onToggle(id, snap); setName(""); }} style={{ padding: "10px 14px", borderRadius: "10px", border: "none", background: name.trim() ? C.accent : C.border, color: name.trim() ? C.onAccent : C.hint, fontSize: "13px", fontWeight: 700, cursor: name.trim() ? "pointer" : "default" }}>Create</button>
        </div>
        <button onClick={onClose} style={{ width: "100%", marginTop: "12px", padding: "11px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Done</button>
      </div>
    </div>
  );
}

function Tile({ snap, onOpen, onRemove }) {
  const col = snap.media?.trend === "up" ? C.up : snap.media?.trend === "down" ? C.down : C.text;
  return (
    <button onClick={onOpen} style={{ position: "relative", aspectRatio: "1 / 1", background: `linear-gradient(150deg, ${C.surface}, ${C.card})`, border: "0.5px solid " + C.border, cursor: "pointer", overflow: "hidden", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {snap.image
        ? <img src={snap.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : snap.media
          ? <span style={{ display: "flex", flexDirection: "column", gap: "2px", textAlign: "center", padding: "6px" }}><span style={{ fontSize: "19px", fontWeight: 800, color: snap.media.trend ? col : C.text, lineHeight: 1 }}>{snap.media.big}</span></span>
          : <span style={{ fontSize: "11px", color: C.sub, padding: "8px", lineHeight: 1.4, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{snap.caption}</span>}
      <span onClick={e => { e.stopPropagation(); onRemove(); }} aria-label="Remove" style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.55)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>✕</span>
    </button>
  );
}

// The Saved screen (lives in Settings → Account → Saved). Lists playlists; open
// one to see its grid; create / rename / delete playlists; remove saved items.
export function SavedView({ playlists, onToggle, onCreate, onRename, onDelete }) {
  const [openId, setOpenId] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [newName, setNewName] = useState("");
  const open = playlists.find(p => p.id === openId);

  if (open) {
    return (
      <>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
          <button onClick={() => setOpenId(null)} style={{ background: "none", border: "none", color: C.accent, fontSize: "14px", fontWeight: 600, cursor: "pointer", padding: 0 }}>← Playlists</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <input defaultValue={open.name} onBlur={e => onRename(open.id, e.target.value.trim() || open.name)} style={{ fontSize: "18px", fontWeight: 800, color: C.text, background: "none", border: "none", outline: "none", flex: 1, minWidth: 0 }} />
          <button onClick={() => { if (window.confirm(`Delete the “${open.name}” playlist? Saved posts in it are removed.`)) { onDelete(open.id); setOpenId(null); } }} style={{ background: "none", border: "0.5px solid " + C.border, borderRadius: "9px", color: C.down, fontSize: "12px", fontWeight: 600, cursor: "pointer", padding: "7px 11px" }}>Delete</button>
        </div>
        {open.items.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3px" }}>
            {open.items.map(it => <Tile key={it.id} snap={it} onOpen={() => setViewing(it)} onRemove={() => onToggle(open.id, it)} />)}
          </div>
        ) : (
          <div style={{ textAlign: "center", color: C.hint, fontSize: "13px", padding: "30px 16px", border: "0.5px dashed " + C.border, borderRadius: "16px", lineHeight: 1.6 }}>
            Nothing saved here yet. Tap the 🔖 bookmark on any post in your Feed to add it.
          </div>
        )}
        <PostView snap={viewing} onClose={() => setViewing(null)} />
      </>
    );
  }

  return (
    <>
      <div style={{ fontSize: "12px", color: C.hint, lineHeight: 1.6, marginBottom: "14px" }}>
        Save posts from your Feed with the 🔖 bookmark, then organize them into playlists here.
      </div>
      {playlists.map(pl => (
        <button key={pl.id} onClick={() => setOpenId(pl.id)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "12px 4px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
          <span style={{ width: 44, height: 44, borderRadius: "12px", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "18px" }}>🔖</span>
          <span style={{ flex: 1 }}>
            <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: C.text }}>{pl.name}</span>
            <span style={{ fontSize: "11px", color: C.hint }}>{pl.items.length} post{pl.items.length === 1 ? "" : "s"}</span>
          </span>
          <span style={{ color: C.hint, fontSize: "18px" }}>›</span>
        </button>
      ))}
      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
        <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New playlist (e.g. Motivation)" style={{ flex: 1, padding: "11px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", outline: "none" }} />
        <button disabled={!newName.trim()} onClick={() => { onCreate(newName.trim()); setNewName(""); }} style={{ padding: "11px 15px", borderRadius: "10px", border: "none", background: newName.trim() ? C.accent : C.border, color: newName.trim() ? C.onAccent : C.hint, fontSize: "13px", fontWeight: 700, cursor: newName.trim() ? "pointer" : "default" }}>Create</button>
      </div>
    </>
  );
}
