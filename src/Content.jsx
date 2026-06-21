import { useEffect, useState } from "react";
import { C } from "./theme";
import { PostView } from "./Saved";
import { getArchivedPosts, getDeletedPosts, getActivity, archivePost, unarchivePost, restorePost, purgePost } from "./social";

// ─────────────────────────────────────────────────────────────────────────────
// Content controls (Settings → Content): Archive, Recently deleted, Activity.
// Self-fetching views; call onChanged() after a mutation so the profile grid
// upstream re-syncs.
// ─────────────────────────────────────────────────────────────────────────────

const card = { background: C.card, border: "0.5px solid " + C.border, borderRadius: "16px", padding: "14px" };
const toSnap = p => ({ id: p.id, author: "You", handle: "@you", initial: "Y", time: "", tag: "", kind: p.image_url ? "photo" : "text", caption: p.caption, image: p.image_url || null, media: null });

function Thumb({ p, children }) {
  return (
    <div style={{ position: "relative", aspectRatio: "1 / 1", background: `linear-gradient(150deg, ${C.surface}, ${C.card})`, border: "0.5px solid " + C.border, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {p.image_url
        ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : <span style={{ fontSize: "11px", color: C.sub, padding: "8px", lineHeight: 1.4, textAlign: "center", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.caption}</span>}
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ textAlign: "center", color: C.hint, fontSize: "13px", padding: "30px 16px", border: "0.5px dashed " + C.border, borderRadius: "16px", lineHeight: 1.6 }}>{children}</div>;
}

const pill = (col) => ({ flex: 1, padding: "7px", borderRadius: "8px", border: "0.5px solid " + C.border, background: C.surface, color: col || C.text, fontSize: "11px", fontWeight: 700, cursor: "pointer" });

// ── Archive ───────────────────────────────────────────────────────────────────
export function ArchiveView({ userId, onChanged }) {
  const [rows, setRows] = useState(null);
  const [view, setView] = useState(null);
  const load = () => getArchivedPosts(userId).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const unarch = async id => { await unarchivePost(id); await load(); onChanged?.(); };
  const del = async id => { if (window.confirm("Move this archived post to Recently deleted?")) { const { deletePost } = await import("./social"); await deletePost(id); await load(); onChanged?.(); } };

  if (rows === null) return <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center" }}>Loading…</div>;
  return (
    <>
      <div style={{ fontSize: "12px", color: C.hint, lineHeight: 1.6, marginBottom: "14px" }}>
        Archived posts are hidden from your profile and the feed, but kept private here. Only you can see them.
      </div>
      {rows.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
          {rows.map(p => (
            <div key={p.id}>
              <button onClick={() => setView(toSnap(p))} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}><Thumb p={p} /></button>
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                <button onClick={() => unarch(p.id)} style={pill()}>Unarchive</button>
                <button onClick={() => del(p.id)} style={pill(C.down)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>Nothing archived.<br />Archive a post from your profile in <strong style={{ color: C.text }}>Edit posts</strong> mode.</Empty>}
      <PostView snap={view} onClose={() => setView(null)} />
    </>
  );
}

// ── Recently deleted ────────────────────────────────────────────────────────────
export function RemovedView({ userId, onChanged }) {
  const [rows, setRows] = useState(null);
  const [view, setView] = useState(null);
  const load = () => getDeletedPosts(userId).then(setRows).catch(() => setRows([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const restore = async id => { await restorePost(id); await load(); onChanged?.(); };
  const purge = async id => { if (window.confirm("Permanently delete this post now? This can't be undone.")) { await purgePost(id); await load(); onChanged?.(); } };

  if (rows === null) return <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center" }}>Loading…</div>;
  return (
    <>
      <div style={{ fontSize: "12px", color: C.hint, lineHeight: 1.6, marginBottom: "14px" }}>
        Deleted posts stay here for <strong style={{ color: C.text }}>30 days</strong>, then they're permanently removed. Restore anything you change your mind about.
      </div>
      {rows.length ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
          {rows.map(p => (
            <div key={p.id}>
              <button onClick={() => setView(toSnap(p))} style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}>
                <Thumb p={p}>
                  <span style={{ position: "absolute", bottom: 4, left: 4, right: 4, fontSize: "9px", fontWeight: 700, color: "#fff", background: "rgba(0,0,0,0.6)", borderRadius: "5px", padding: "2px 5px", textAlign: "center" }}>{p.days_left}d left</span>
                </Thumb>
              </button>
              <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                <button onClick={() => restore(p.id)} style={pill(C.up)}>Restore</button>
                <button onClick={() => purge(p.id)} style={pill(C.down)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>Recently deleted is empty.</Empty>}
      <PostView snap={view} onClose={() => setView(null)} />
    </>
  );
}

// ── Activity / insights ──────────────────────────────────────────────────────
function StatCard({ big, label, icon }) {
  return (
    <div style={{ ...card, textAlign: "center", padding: "16px 10px" }}>
      <div style={{ fontSize: "18px", marginBottom: "4px" }}>{icon}</div>
      <div className="tnum" style={{ fontSize: "22px", fontWeight: 800, color: C.text }}>{big}</div>
      <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px" }}>{label}</div>
    </div>
  );
}

function ActorRow({ a, meta }) {
  const p = a.actor || {};
  const name = p.display_name?.trim() || (p.handle ? "@" + p.handle : "Someone");
  const init = (p.display_name?.[0] || p.handle?.[0] || "?").toUpperCase();
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderTop: "0.5px solid " + C.border }}>
      {p.avatar_url
        ? <img src={p.avatar_url} alt="" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover" }} />
        : <span style={{ width: 34, height: 34, borderRadius: "50%", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 700, color: C.text }}>{init}</span>}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{name}</div>
        {meta && <div style={{ fontSize: "11px", color: C.hint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{meta}</div>}
      </div>
    </div>
  );
}

export function ActivityView({ userId }) {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState("likes");
  useEffect(() => { getActivity(userId).then(setData).catch(() => setData({ likeCount: 0, commentCount: 0, repostCount: 0, tagCount: 0, interactions: 0, recentLikes: [], recentComments: [] })); }, [userId]);

  if (data === null) return <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center" }}>Loading your insights…</div>;
  return (
    <>
      <div style={{ ...card, textAlign: "center", marginBottom: "12px" }}>
        <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.hint }}>Total interactions</div>
        <div className="tnum" style={{ fontSize: "38px", fontWeight: 800, color: C.text, letterSpacing: "-0.02em", marginTop: "4px" }}>{data.interactions.toLocaleString()}</div>
        <div style={{ fontSize: "12px", color: C.sub }}>across all your posts</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", marginBottom: "8px" }}>
        <StatCard big={data.likeCount.toLocaleString()} label="Likes received" icon="❤️" />
        <StatCard big={data.commentCount.toLocaleString()} label="Comments" icon="💬" />
        <StatCard big={data.repostCount.toLocaleString()} label="Reposts" icon="🔁" />
        <StatCard big={data.tagCount.toLocaleString()} label="Tags" icon="🏷️" />
      </div>
      <div style={{ fontSize: "11px", color: C.hint, textAlign: "center", margin: "4px 0 16px" }}>Reposts & tags activate with the social backend rollout.</div>

      <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
        {[["likes", "Recent likes"], ["comments", "Recent comments"]].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "0.5px solid " + (tab === k ? C.accent : C.border), background: tab === k ? C.accent : C.surface, color: tab === k ? C.onAccent : C.sub, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{l}</button>
        ))}
      </div>
      <div style={card}>
        {tab === "likes" ? (
          data.recentLikes.length
            ? data.recentLikes.map((a, i) => <ActorRow key={i} a={a} meta="liked your post" />)
            : <div style={{ color: C.hint, fontSize: "13px", textAlign: "center", padding: "14px" }}>No likes yet.</div>
        ) : (
          data.recentComments.length
            ? data.recentComments.map((a, i) => <ActorRow key={i} a={a} meta={a.body} />)
            : <div style={{ color: C.hint, fontSize: "13px", textAlign: "center", padding: "14px" }}>No comments yet.</div>
        )}
      </div>
    </>
  );
}
