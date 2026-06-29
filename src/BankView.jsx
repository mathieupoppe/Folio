import { useEffect, useState } from "react";
import { C } from "./theme";
import { getBankConnections, getBankAccounts, listBanks, startBankLink, setIncludeInNetworth, removeBankConnection, syncBank, bankRedirectUrl } from "./bank";

// ─────────────────────────────────────────────────────────────────────────────
// Bank connection UI (Phase A) — connect a bank, see linked accounts + balances,
// toggle which count toward net worth, sync, and disconnect. Read-only.
// The actual data plumbing is in bank.js; this degrades gracefully (shows a
// helpful message) until the bank-* edge functions are deployed.
// ─────────────────────────────────────────────────────────────────────────────

const fmtMoney = (n, ccy) => {
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency: ccy || "EUR", maximumFractionDigits: 0 }).format(n || 0); }
  catch { return (ccy || "€") + " " + Math.round(n || 0).toLocaleString(); }
};

// Bank picker sheet → starts consent and redirects to the bank.
function BankPicker({ country, onClose }) {
  const [banks, setBanks] = useState(null);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { listBanks(country).then(setBanks).catch(e => { setErr(e?.message || String(e)); setBanks([]); }); }, [country]);

  const pick = async (b) => {
    setBusy(true); setErr("");
    try { const { url } = await startBankLink(b.name, b.country || country, bankRedirectUrl()); window.location.href = url; }
    catch (e) { setErr(e?.message || String(e)); setBusy(false); }
  };
  const shown = (banks || []).filter(b => b.name?.toLowerCase().includes(q.toLowerCase()));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 96, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, maxHeight: "82vh", overflowY: "auto", background: C.card, borderRadius: "20px 20px 0 0", borderTop: "0.5px solid " + C.border, padding: "16px 16px calc(20px + env(safe-area-inset-bottom))" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ fontSize: "16px", fontWeight: 800, color: C.text }}>Choose your bank</span>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", fontSize: "20px" }}>✕</button>
        </div>
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search banks…" style={{ width: "100%", boxSizing: "border-box", padding: "11px 13px", borderRadius: "12px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "14px", outline: "none", marginBottom: "12px" }} />
        {err && <div style={{ fontSize: "12px", color: C.down, marginBottom: "10px", lineHeight: 1.5 }}>{err}</div>}
        {busy && <div style={{ fontSize: "13px", color: C.hint, padding: "12px", textAlign: "center" }}>Redirecting to your bank…</div>}
        {banks === null ? <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center" }}>Loading banks…</div>
          : !banks.length ? <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center", lineHeight: 1.6 }}>No banks available yet. The bank connection backend needs to be deployed first.</div>
            : shown.map(b => (
              <button key={b.name} disabled={busy} onClick={() => pick(b)} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", padding: "11px 4px", background: "none", border: "none", borderBottom: "0.5px solid " + C.border, cursor: "pointer", textAlign: "left" }}>
                {b.logo ? <img src={b.logo} alt="" style={{ width: 28, height: 28, borderRadius: 6, objectFit: "contain" }} /> : <span style={{ width: 28, height: 28, borderRadius: 6, background: C.surface, border: "0.5px solid " + C.border }} />}
                <span style={{ fontSize: "14px", fontWeight: 600, color: C.text }}>{b.name}</span>
              </button>
            ))}
      </div>
    </div>
  );
}

export default function BankSettings({ userId, country = "BE", onChanged }) {
  const [conns, setConns] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [picking, setPicking] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const load = async () => {
    try {
      const [c, a] = await Promise.all([getBankConnections(userId), getBankAccounts(userId)]);
      setConns(c); setAccounts(a);
    } catch { setConns([]); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [userId]);

  const toggle = async (acc) => {
    setAccounts(as => as.map(x => x.id === acc.id ? { ...x, include_in_networth: !x.include_in_networth } : x));
    try { await setIncludeInNetworth(acc.id, !acc.include_in_networth); onChanged?.(); }
    catch { load(); }
  };
  const sync = async () => {
    setSyncing(true);
    try { await syncBank(); await load(); onChanged?.(); }
    catch (e) { window.alert("Sync failed: " + (e?.message || e)); }
    finally { setSyncing(false); }
  };
  const remove = async (conn) => {
    if (!window.confirm(`Disconnect ${conn.aspsp_name}? Its accounts stop counting toward your net worth.`)) return;
    try { await removeBankConnection(conn.id); await load(); onChanged?.(); }
    catch (e) { window.alert("Couldn't disconnect: " + (e?.message || e)); }
  };

  const acctsFor = (cid) => accounts.filter(a => a.connection_id === cid);

  return (
    <div className="ffade">
      <div style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: "16px", padding: "16px", marginBottom: "12px" }}>
        <div style={{ fontSize: "14px", fontWeight: 800, color: C.text, marginBottom: "4px" }}>Connect your bank</div>
        <div style={{ fontSize: "12px", color: C.hint, lineHeight: 1.55, marginBottom: "12px" }}>Securely link your bank (read-only) so your balances — and soon your spending — update automatically. Folio can never move your money.</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={() => setPicking(true)} style={{ flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: C.accent, color: C.onAccent, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>+ Connect a bank</button>
          {conns?.length > 0 && <button onClick={sync} disabled={syncing} style={{ padding: "11px 14px", borderRadius: "10px", border: "0.5px solid " + C.border, background: C.surface, color: C.text, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>{syncing ? "Syncing…" : "Sync now"}</button>}
        </div>
      </div>

      {conns === null ? <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center" }}>Loading…</div>
        : !conns.length ? <div style={{ color: C.hint, fontSize: "13px", padding: "20px", textAlign: "center", lineHeight: 1.6 }}>No banks connected yet.</div>
          : conns.map(conn => (
            <div key={conn.id} style={{ background: C.card, border: "0.5px solid " + C.border, borderRadius: "14px", padding: "13px", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: C.text }}>{conn.aspsp_name}</div>
                  <div style={{ fontSize: "11px", color: conn.status === "linked" ? C.up : conn.status === "expired" ? C.warn : C.hint }}>{conn.status === "linked" ? "Connected" : conn.status === "pending" ? "Awaiting consent" : conn.status === "expired" ? "Expired — reconnect" : conn.status}</div>
                </div>
                <button onClick={() => remove(conn)} style={{ background: "none", border: "0.5px solid " + C.border, color: C.down, fontSize: "12px", fontWeight: 700, padding: "6px 12px", borderRadius: "999px", cursor: "pointer" }}>Disconnect</button>
              </div>
              {acctsFor(conn.id).map(a => (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 0", borderTop: "0.5px solid " + C.border }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 600, color: C.text }}>{a.name} {a.iban_last4 && <span style={{ color: C.hint, fontWeight: 400 }}>···{a.iban_last4}</span>}</div>
                    <div className="tnum" style={{ fontSize: "12px", color: C.sub }}>{fmtMoney(a.balance, a.currency)}</div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: C.hint, cursor: "pointer" }}>
                    <input type="checkbox" checked={!!a.include_in_networth} onChange={() => toggle(a)} /> net worth
                  </label>
                </div>
              ))}
            </div>
          ))}

      {picking && <BankPicker country={country} onClose={() => setPicking(false)} />}
    </div>
  );
}
