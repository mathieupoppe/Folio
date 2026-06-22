import { useRef, useState } from "react";
import { C } from "./theme";
import { PostView } from "./Saved";
import Comments from "./Comments";

// Profile page — your finance identity. Avatar, bio, follower counts, and a grid
// of YOUR posts (add / edit / delete, persisted with your data). Editing your
// name/bio/handle happens inline here (Edit profile), so you never leave the
// page. Account-level changes (name that syncs everywhere, security, etc.) also
// live behind the settings gear, top-right.
// Follower/following counts are sample until the social backend goes live.

const inp = { width: "100%", padding: "10px 12px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, fontSize: "13px", outline: "none", color: C.text, boxSizing: "border-box" };

function Stat({ n, label }) {
  return (
    <div style={{ flex: 1, textAlign: "center" }}>
      <div className="tnum" style={{ fontSize: "18px", fontWeight: 800, color: C.text }}>{n}</div>
      <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>{label}</div>
    </div>
  );
}

// A small inline composer for creating or editing a post (caption + optional image).
function PostComposer({ initial, onSave, onCancel, busy }) {
  const [caption, setCaption] = useState(initial?.caption || "");
  const [image, setImage] = useState(initial?.image || null); // preview (data URL or existing URL)
  const [file, setFile] = useState(null); // new File to upload, if any
  const fileRef = useRef(null);
  const pick = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const r = new FileReader();
    r.onload = () => setImage(r.result);
    r.readAsDataURL(f);
  };
  const clearImg = () => { setImage(null); setFile(null); };
  const canSave = caption.trim() || image;
  return (
    <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: "16px", padding: "14px", marginBottom: "16px" }}>
      <div style={{ fontSize: "13px", fontWeight: 800, color: C.text, marginBottom: "10px" }}>{initial ? "Edit post" : "New post"}</div>
      <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Share a win, a chart, a money tip or some motivation…" rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
      {image && (
        <div style={{ position: "relative", marginTop: "10px" }}>
          <img src={image} alt="" style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: "12px", border: "0.5px solid " + C.border, display: "block" }} />
          <button onClick={clearImg} aria-label="Remove image" style={{ position: "absolute", top: 8, right: 8, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", fontSize: "14px" }}>✕</button>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: "none" }} />
      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <button onClick={() => fileRef.current?.click()} style={{ padding: "9px 13px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>📷 {image ? "Change photo" : "Add photo"}</button>
        <div style={{ flex: 1 }} />
        <button onClick={onCancel} style={{ padding: "9px 13px", borderRadius: "10px", border: "none", background: "transparent", color: C.hint, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        <button disabled={!canSave || busy} onClick={() => onSave({ caption: caption.trim(), image, file, removedImage: !image })} style={{ padding: "9px 15px", borderRadius: "10px", border: "none", background: (canSave && !busy) ? C.accent : C.border, color: (canSave && !busy) ? C.onAccent : C.hint, fontSize: "13px", fontWeight: 700, cursor: (canSave && !busy) ? "pointer" : "default" }}>{busy ? "Saving…" : initial ? "Save" : "Post"}</button>
      </div>
    </div>
  );
}

export default function Profile({ profile = {}, setProfile, posts = [], counts = {}, onCreatePost, onUpdatePost, onDeletePost, onArchivePost, currentUserId, allowReplies = true, email, onSettings }) {
  const fileRef = useRef(null);
  const [editing, setEditing] = useState(false);
  const [composer, setComposer] = useState(null); // null | { id?, caption, image }
  const [busy, setBusy] = useState(false);
  const [editMode, setEditMode] = useState(false); // posts edit mode (tap = edit; else tap = zoom)
  const [viewing, setViewing] = useState(null); // snapshot being zoomed
  const [draft, setDraft] = useState(profile);
  const nameStr = (profile.first || profile.last) ? `${profile.first || ""} ${profile.last || ""}`.trim() : (profile.handle || "You");
  const myInit = profile.first?.[0] || email?.[0] || "Y";
  const toSnap = p => ({ id: p.id, author: nameStr, handle: profile.handle || "@you", initial: myInit, time: (() => { try { return new Date(p.createdAt).toLocaleDateString(); } catch { return ""; } })(), tag: "You", kind: p.image ? "photo" : "text", caption: p.caption, image: p.image || null, media: null });

  const name = (profile.first || profile.last) ? `${profile.first || ""} ${profile.last || ""}`.trim() : "Your name";
  const handle = profile.handle || "@" + (email ? email.split("@")[0] : "you");
  const initial = profile.first?.[0] || email?.[0] || "Y";

  const pickAvatar = e => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => setProfile?.({ ...profile, avatar: r.result });
    r.readAsDataURL(f);
  };

  const startEdit = () => { setDraft(profile); setEditing(true); };
  const saveEdit = () => { setProfile?.({ ...profile, ...draft }); setEditing(false); };

  const savePost = async ({ caption, image, file, removedImage }) => {
    setBusy(true);
    try {
      if (composer?.id) await onUpdatePost?.(composer.id, { caption, file, keepImage: image && !file, removedImage });
      else await onCreatePost?.({ caption, file });
      setComposer(null);
    } catch (e) { window.alert("Couldn't save your post: " + (e?.message || e)); }
    finally { setBusy(false); }
  };
  const deletePost = async id => {
    if (!window.confirm("Delete this post? It moves to Recently deleted for 30 days.")) return;
    try { await onDeletePost?.(id); } catch (e) { window.alert("Couldn't delete: " + (e?.message || e)); }
  };
  const archivePost = async id => {
    try { await onArchivePost?.(id); } catch (e) { window.alert("Couldn't archive: " + (e?.message || e)); }
  };

  return (
    <div className="ffade">
      {/* top bar: handle + settings gear */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
        <div style={{ fontSize: "17px", fontWeight: 800, color: C.text }}>{handle}</div>
        <button onClick={onSettings} aria-label="Settings" style={{ background: "none", border: "none", cursor: "pointer", color: C.text, padding: "4px" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
        </button>
      </div>

      {/* avatar + stats */}
      <div style={{ display: "flex", alignItems: "center", gap: "18px", marginBottom: "14px" }}>
        <button onClick={() => fileRef.current?.click()} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", position: "relative", flexShrink: 0 }}>
          {profile.avatar
            ? <img src={profile.avatar} alt="" style={{ width: 82, height: 82, borderRadius: "50%", objectFit: "cover", border: "0.5px solid " + C.border }} />
            : <div style={{ width: 82, height: 82, borderRadius: "50%", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", fontWeight: 700, color: C.text, textTransform: "uppercase" }}>{initial}</div>}
          <div style={{ position: "absolute", right: -2, bottom: -2, width: 26, height: 26, borderRadius: "50%", background: C.accent, color: C.onAccent, display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid " + C.bg }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          </div>
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={pickAvatar} style={{ display: "none" }} />
        <div style={{ display: "flex", flex: 1 }}>
          <Stat n={counts.posts ?? posts.length} label="Posts" />
          <Stat n={counts.followers ?? 0} label="Followers" />
          <Stat n={counts.following ?? 0} label="Following" />
        </div>
      </div>

      {/* name + bio  OR  inline edit panel */}
      {!editing ? (
        <>
          <div style={{ marginBottom: "14px" }}>
            <div style={{ fontSize: "14px", fontWeight: 800, color: C.text }}>{name}</div>
            <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.5, marginTop: "3px", whiteSpace: "pre-line" }}>
              {profile.bio || "No bio yet — tap “Edit profile” to add one. 📈"}
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
            <button onClick={startEdit} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Edit profile</button>
            <button onClick={() => setComposer({ caption: "", image: null })} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>+ New post</button>
          </div>
        </>
      ) : (
        <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: "16px", padding: "14px", marginBottom: "20px" }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: C.text, marginBottom: "10px" }}>Edit profile</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
            <input placeholder="First name" value={draft.first || ""} onChange={e => setDraft({ ...draft, first: e.target.value })} style={inp} />
            <input placeholder="Last name" value={draft.last || ""} onChange={e => setDraft({ ...draft, last: e.target.value })} style={inp} />
          </div>
          <input placeholder="@username" value={draft.handle || ""} onChange={e => setDraft({ ...draft, handle: e.target.value.startsWith("@") || !e.target.value ? e.target.value : "@" + e.target.value })} style={{ ...inp, marginBottom: "8px" }} />
          <textarea placeholder="Bio — what's your money mission?" value={draft.bio || ""} onChange={e => setDraft({ ...draft, bio: e.target.value })} rows={3} style={{ ...inp, resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button onClick={() => setEditing(false)} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "none", background: "transparent", color: C.hint, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            <button onClick={saveEdit} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Save</button>
          </div>
        </div>
      )}

      {/* composer */}
      {composer && <PostComposer initial={composer.id ? composer : null} onSave={savePost} onCancel={() => setComposer(null)} busy={busy} />}

      {/* posts header + edit toggle */}
      {posts.length > 0 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>Posts</span>
          <button onClick={() => setEditMode(v => !v)} style={{ background: editMode ? C.accent : "none", border: editMode ? "none" : "0.5px solid " + C.border, borderRadius: "9px", padding: "6px 12px", fontSize: "12px", fontWeight: 700, color: editMode ? C.onAccent : C.sub, cursor: "pointer" }}>{editMode ? "Done" : "Edit posts"}</button>
        </div>
      )}

      {/* posts grid */}
      {posts.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "3px" }}>
          {posts.map(p => (
            <button key={p.id} onClick={() => editMode ? setComposer({ id: p.id, caption: p.caption, image: p.image }) : setViewing(toSnap(p))} style={{ position: "relative", aspectRatio: "1 / 1", background: `linear-gradient(150deg, ${C.surface}, ${C.card})`, border: "0.5px solid " + C.border, cursor: "pointer", overflow: "hidden", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {p.image
                ? <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <span style={{ fontSize: "11px", color: C.sub, padding: "8px", lineHeight: 1.4, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.caption}</span>}
              {editMode && <>
                <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)" }} />
                <span style={{ position: "absolute", bottom: 4, left: 4, fontSize: "10px", fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.55)", borderRadius: "6px", padding: "2px 6px" }}>Edit</span>
                <span onClick={e => { e.stopPropagation(); archivePost(p.id); }} aria-label="Archive post" title="Archive" style={{ position: "absolute", top: 4, left: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>🗄</span>
                <span onClick={e => { e.stopPropagation(); deletePost(p.id); }} aria-label="Delete post" style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px" }}>✕</span>
              </>}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", color: C.hint, fontSize: "13px", padding: "30px 16px", border: "0.5px dashed " + C.border, borderRadius: "16px", lineHeight: 1.6 }}>
          No posts yet.<br />Tap <strong style={{ color: C.text }}>+ New post</strong> to share your first finance win or tip.
        </div>
      )}

      <div style={{ textAlign: "center", color: C.hint, fontSize: "11px", padding: "16px 0 4px", lineHeight: 1.6 }}>
        Posts are saved to your account. Public sharing & followers go live with the social backend.
      </div>

      <PostView snap={viewing} onClose={() => setViewing(null)} commentsSlot={viewing && <Comments postId={viewing.id} currentUserId={currentUserId} allowReplies={allowReplies} />} />
    </div>
  );
}
