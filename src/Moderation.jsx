import { useEffect, useState } from "react";
import { C } from "./theme";
import { fileReport, getReports, getReportCount, resolveReport, adminRemovePost, getBlocked, unblockUser } from "./social";

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 — moderation UI: report sheet, admin review queue, blocked-accounts
// list, and the Terms of Service text. Backed by 0008_moderation.sql.
// ─────────────────────────────────────────────────────────────────────────────

const REASONS = [
  { id: "spam", label: "Spam or scam", desc: "Misleading promos, fake giveaways, pump-and-dump" },
  { id: "harassment", label: "Harassment or hate", desc: "Bullying, threats, hateful content" },
  { id: "misinfo", label: "False or harmful advice", desc: "Dangerous or deceptive financial claims" },
  { id: "nudity", label: "Nudity or sexual content", desc: "Sexual or explicit material" },
  { id: "other", label: "Something else", desc: "Doesn't fit the categories above" },
];

// ── Report sheet ──────────────────────────────────────────────────────────────
// target = { postId } or { userId, handle }. Calls onDone() after a filing.
export function ReportSheet({ target, currentUserId, onClose, onDone }) {
  const [reason, setReason] = useState(null);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  if (!target) return null;
  const what = target.postId ? "post" : "@" + (target.handle || "account");

  const submit = async () => {
    if (!reason || busy) return;
    setBusy(true);
    try {
      await fileReport(currentUserId, { postId: target.postId || null, userId: target.userId || null, reason, details: details.trim() });
      setDone(true);
      onDone?.();
    } catch (e) { window.alert("Couldn't send the report: " + (e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 97, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.card, borderRadius: "20px 20px 0 0", borderTop: "0.5px solid " + C.border, padding: "18px 18px calc(18px + env(safe-area-inset-bottom))", maxHeight: "82vh", overflowY: "auto" }}>
        {done ? (
          <div style={{ textAlign: "center", padding: "18px 8px" }}>
            <div style={{ fontSize: "34px", marginBottom: "10px" }}>✓</div>
            <div style={{ fontSize: "16px", fontWeight: 800, color: C.text, marginBottom: "6px" }}>Thanks for the report</div>
            <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.55, marginBottom: "16px" }}>Our team will review this {what}. We don’t share who reported what.</div>
            <button onClick={onClose} style={{ width: "100%", padding: "12px", borderRadius: "12px", border: "none", background: C.accent, color: C.onAccent, fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Done</button>
          </div>
        ) : (<>
          <div style={{ fontSize: "16px", fontWeight: 800, color: C.text, marginBottom: "4px" }}>Report {what}</div>
          <div style={{ fontSize: "12px", color: C.hint, marginBottom: "14px", lineHeight: 1.5 }}>Help keep Folio safe. Your report is anonymous to the person you’re reporting.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {REASONS.map(r => {
              const on = reason === r.id;
              return (
                <button key={r.id} onClick={() => setReason(r.id)} style={{ textAlign: "left", padding: "11px 13px", borderRadius: "12px", border: "0.5px solid " + (on ? C.accent : C.border), background: on ? C.accent + "14" : C.surface, cursor: "pointer" }}>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: on ? C.accent : C.text }}>{r.label}</div>
                  <div style={{ fontSize: "11px", color: C.hint, marginTop: "2px", lineHeight: 1.4 }}>{r.desc}</div>
                </button>
              );
            })}
          </div>
          <textarea value={details} onChange={e => setDetails(e.target.value)} placeholder="Add details (optional)…" rows={2} style={{ width: "100%", boxSizing: "border-box", marginTop: "12px", padding: "10px 12px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <button onClick={onClose} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button onClick={submit} disabled={!reason || busy} style={{ flex: 1, padding: "12px", borderRadius: "12px", border: "none", background: reason ? C.down : C.border, color: reason ? "#fff" : C.hint, fontSize: "14px", fontWeight: 700, cursor: reason ? "pointer" : "default", opacity: busy ? 0.6 : 1 }}>{busy ? "Sending…" : "Submit report"}</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ── Blocked accounts (settings) ───────────────────────────────────────────────
export function BlockedAccounts({ currentUserId }) {
  const [list, setList] = useState(null);
  const load = () => getBlocked(currentUserId).then(setList).catch(() => setList([]));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentUserId]);
  const unblock = async (id) => {
    setList(l => l.filter(u => u.id !== id));
    try { await unblockUser(currentUserId, id); } catch { load(); }
  };
  if (list === null) return <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center" }}>Loading…</div>;
  if (!list.length) return <div style={{ color: C.hint, fontSize: "13px", padding: "24px", textAlign: "center", lineHeight: 1.6 }}>You haven’t blocked anyone.<br />Blocked accounts can’t appear in your feed or search.</div>;
  return (
    <div>
      {list.map(u => (
        <div key={u.id} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 4px", borderBottom: "0.5px solid " + C.border }}>
          <span style={{ width: 40, height: 40, borderRadius: "50%", background: C.surface, border: "0.5px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px", fontWeight: 700, color: C.text, flexShrink: 0 }}>{(u.display_name?.[0] || u.handle?.[0] || "?").toUpperCase()}</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: "block", fontSize: "14px", fontWeight: 700, color: C.text }}>{u.display_name?.trim() || ("@" + u.handle)}</span>
            <span style={{ fontSize: "12px", color: C.hint }}>@{u.handle}</span>
          </span>
          <button onClick={() => unblock(u.id)} style={{ padding: "7px 12px", borderRadius: "999px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Unblock</button>
        </div>
      ))}
    </div>
  );
}

// ── Admin review queue ────────────────────────────────────────────────────────
const TABS = [["open", "Open"], ["reviewing", "Reviewing"], ["resolved", "Resolved"], ["dismissed", "Dismissed"]];

export function AdminQueue({ currentUserId }) {
  const [tab, setTab] = useState("open");
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);
  const load = (t = tab) => { setRows(null); getReports({ status: t }).then(setRows).catch(e => { console.warn(e); setRows([]); }); };
  useEffect(() => { load(tab); /* eslint-disable-next-line */ }, [tab]);

  const act = async (r, status, removePost = false) => {
    setBusy(r.id);
    try {
      if (removePost && r.target_post?.id) await adminRemovePost(r.target_post.id);
      await resolveReport(r.id, currentUserId, status, removePost ? "Post removed" : "");
      setRows(rs => rs.filter(x => x.id !== r.id));
    } catch (e) { window.alert("Action failed: " + (e?.message || e)); }
    finally { setBusy(null); }
  };

  return (
    <div className="ffade">
      <div style={{ display: "flex", gap: "6px", marginBottom: "14px", overflowX: "auto" }} className="noscroll">
        {TABS.map(([id, lbl]) => (
          <button key={id} onClick={() => setTab(id)} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: "999px", border: "0.5px solid " + (tab === id ? C.accent : C.border), background: tab === id ? C.accent + "18" : C.surface, color: tab === id ? C.accent : C.sub, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>{lbl}</button>
        ))}
      </div>
      {rows === null ? <div style={{ color: C.hint, fontSize: "13px", padding: "24px", textAlign: "center" }}>Loading…</div>
        : !rows.length ? <div style={{ color: C.hint, fontSize: "13px", padding: "30px", textAlign: "center", lineHeight: 1.6 }}>Nothing in “{TABS.find(t => t[0] === tab)[1]}”.</div>
          : rows.map(r => {
            const tp = r.target_post, tu = r.target_user;
            const when = (() => { try { return new Date(r.created_at).toLocaleString(); } catch { return ""; } })();
            return (
              <div key={r.id} style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: "14px", padding: "13px", marginBottom: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: C.down }}>{r.reason}</span>
                  <span style={{ fontSize: "11px", color: C.hint }}>{when}</span>
                </div>
                <div style={{ fontSize: "13px", color: C.text, lineHeight: 1.5 }}>
                  {tp ? <>Post by <strong>@{tp.author?.handle || "?"}</strong>{tp.deleted_at && <em style={{ color: C.hint }}> (already removed)</em>}<div style={{ marginTop: "6px", padding: "8px 10px", borderRadius: "10px", background: C.surface, border: "0.5px solid " + C.border, fontSize: "12px", color: C.sub, lineHeight: 1.45 }}>{tp.image_url && <span>🖼 </span>}{tp.caption || "(no caption)"}</div></>
                    : <>Account <strong>@{tu?.handle || "deleted"}</strong>{tu?.display_name ? ` · ${tu.display_name}` : ""}</>}
                </div>
                {r.details && <div style={{ fontSize: "12px", color: C.sub, marginTop: "6px", fontStyle: "italic", lineHeight: 1.45 }}>“{r.details}”</div>}
                <div style={{ fontSize: "11px", color: C.hint, marginTop: "6px" }}>Reported by @{r.reporter?.handle || "user"}</div>
                {(tab === "open" || tab === "reviewing") && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "11px" }}>
                    {tab === "open" && <button disabled={busy === r.id} onClick={() => act(r, "reviewing")} style={btn(C.surface, C.text, C.border)}>Start review</button>}
                    {tp && !tp.deleted_at && <button disabled={busy === r.id} onClick={() => { if (window.confirm("Remove this post and resolve the report?")) act(r, "resolved", true); }} style={btn(C.down + "18", C.down, C.down)}>Remove post</button>}
                    <button disabled={busy === r.id} onClick={() => act(r, "resolved")} style={btn(C.up + "18", C.up, C.up)}>Resolve</button>
                    <button disabled={busy === r.id} onClick={() => act(r, "dismissed")} style={btn(C.surface, C.hint, C.border)}>Dismiss</button>
                  </div>
                )}
                {(tab === "resolved" || tab === "dismissed") && r.action_taken && <div style={{ fontSize: "11px", color: C.hint, marginTop: "8px" }}>Outcome: {r.action_taken}</div>}
              </div>
            );
          })}
    </div>
  );
}
const btn = (bg, fg, bd) => ({ padding: "8px 12px", borderRadius: "999px", border: "0.5px solid " + bd, background: bg, color: fg, fontSize: "12px", fontWeight: 700, cursor: "pointer" });

// ── Admin queue entry badge (shows open count) ────────────────────────────────
export function useOpenReportCount(isAdmin) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!isAdmin) return;
    getReportCount("open").then(setN).catch(() => {});
  }, [isAdmin]);
  return n;
}

// ── Terms of Service (static) ─────────────────────────────────────────────────
export function TermsOfService() {
  const P = ({ h, children }) => (
    <p style={{ margin: "0 0 12px" }}><strong style={{ color: C.text }}>{h}</strong> {children}</p>
  );
  return (
    <div style={{ fontSize: "13px", color: C.sub, lineHeight: 1.65 }}>
      <P h="Acceptable use.">You agree not to post content that is illegal, hateful, harassing, sexually explicit, spam, or that promotes scams or fraudulent financial schemes. Nothing on Folio is financial advice.</P>
      <P h="Zero tolerance for abuse.">Folio has no tolerance for objectionable content or abusive users. Reported content is reviewed and offending content is removed, and repeat offenders are banned, within 24 hours.</P>
      <P h="Reporting & blocking.">Every post and profile can be reported, and you can block any account so it disappears from your feed and search. Reports are anonymous to the person reported.</P>
      <P h="Your content.">You own what you post. By posting you grant Folio a licence to display it inside the app. You’re responsible for what you share.</P>
      <P h="Termination.">We may remove content or suspend accounts that break these terms.</P>
      <P h="Contact.">Questions or appeals: mathieu.poppe2008@gmail.com</P>
    </div>
  );
}
