// Enable Banking API client (read-only AIS). Auth is an RS256 JWT signed with our
// application's private key; the Application ID is the JWT `kid`. The private key
// + app id live only as Supabase secrets (ENABLEBANKING_PRIVATE_KEY / _APP_ID).
//
// Docs: https://enablebanking.com/docs/api/reference/
import { SignJWT, importPKCS8 } from "https://esm.sh/jose@5.9.6";

const BASE = "https://api.enablebanking.com";

export const ebConfigured = () =>
  Boolean(Deno.env.get("ENABLEBANKING_APP_ID") && Deno.env.get("ENABLEBANKING_PRIVATE_KEY"));

// Mint a short-lived signed JWT for the Authorization header.
async function makeJwt(): Promise<string> {
  const appId = Deno.env.get("ENABLEBANKING_APP_ID")!;
  const pem = Deno.env.get("ENABLEBANKING_PRIVATE_KEY")!;
  const key = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: appId })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}

async function ebFetch(path: string, init: RequestInit = {}) {
  const jwt = await makeJwt();
  const res = await fetch(BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Enable Banking ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// GET /aspsps?country=XX — list of banks.
export const listAspsps = (country: string) =>
  ebFetch(`/aspsps?country=${encodeURIComponent(country)}`).then(d => d.aspsps || []);

// POST /auth — start the hosted consent. Returns { url } to send the user to.
export function startAuth(opts: { name: string; country: string; redirectUrl: string; state: string; validUntil: string }) {
  return ebFetch(`/auth`, {
    method: "POST",
    body: JSON.stringify({
      access: { valid_until: opts.validUntil },
      aspsp: { name: opts.name, country: opts.country },
      state: opts.state,
      redirect_url: opts.redirectUrl,
      psu_type: "personal",
    }),
  }); // → { url }
}

// POST /sessions — exchange the redirect `code` for a session + account uids.
export const createSession = (code: string) =>
  ebFetch(`/sessions`, { method: "POST", body: JSON.stringify({ code }) }); // → { session_id, accounts, ... }

export const getAccountDetails = (uid: string) => ebFetch(`/accounts/${uid}/details`);
export const getBalances = (uid: string) => ebFetch(`/accounts/${uid}/balances`);
export const getTransactions = (uid: string, dateFrom?: string) =>
  ebFetch(`/accounts/${uid}/transactions${dateFrom ? `?date_from=${dateFrom}` : ""}`);
