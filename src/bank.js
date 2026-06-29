import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Bank connection data layer (Phase A) — talks to the bank_* tables (read) and
// the bank-* edge functions (provider actions). Read-only open banking via
// Enable Banking; balances fold into net worth. See docs/bank-connection-plan.md.
// Everything degrades gracefully until the edge functions are deployed.
// ─────────────────────────────────────────────────────────────────────────────

export async function getBankConnections(userId) {
  const { data, error } = await supabase
    .from("bank_connections").select("id, aspsp_name, aspsp_country, status, created_at")
    .eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getBankAccounts(userId) {
  const { data, error } = await supabase
    .from("bank_accounts").select("id, connection_id, name, iban_last4, currency, balance, include_in_networth, last_synced")
    .eq("user_id", userId).order("name");
  if (error) throw error;
  return data || [];
}

// Sum of included account balances (Phase A: assumes one currency; multi-currency
// FX folding comes with the FX work). Returns a number to add to total assets.
export function bankBalanceTotal(accounts = []) {
  return accounts.filter(a => a.include_in_networth).reduce((s, a) => s + (Number(a.balance) || 0), 0);
}

export async function setIncludeInNetworth(accountId, value) {
  const { error } = await supabase.from("bank_accounts").update({ include_in_networth: value }).eq("id", accountId);
  if (error) throw error;
}

// Removing a connection cascades to its accounts, sessions and transactions.
export async function removeBankConnection(connectionId) {
  const { error } = await supabase.from("bank_connections").delete().eq("id", connectionId);
  if (error) throw error;
}

// ── Edge-function actions ─────────────────────────────────────────────────────
async function invoke(fn, body) {
  const { data, error } = await supabase.functions.invoke(fn, body ? { body } : undefined);
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

export const listBanks = (country = "BE") => invoke("bank-institutions", { country }).then(d => d.banks || []);

// Returns { url, connectionId } — open `url` for the user to consent.
export const startBankLink = (name, country, redirectUrl) =>
  invoke("bank-link", { name, country, redirectUrl });

export const finaliseBank = (code, connectionId) => invoke("bank-finalise", { code, connectionId });

export const syncBank = () => invoke("bank-sync").then(d => d.synced ?? 0);

// The redirect URL we hand the provider; it returns ?code=...&state=<connectionId>.
export const bankRedirectUrl = () => `${location.origin}${location.pathname}?bank=callback`;
