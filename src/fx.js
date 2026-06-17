// Foreign-exchange rates via open.er-api.com (free, no key, CORS, 160+ currencies).
// Used to convert all stored amounts when the user changes display currency.
const _cache = new Map(); // base -> { t, rates }
const TTL = 3600000; // 1h

async function ratesFor(base) {
  const hit = _cache.get(base);
  if (hit && Date.now() - hit.t < TTL) return hit.rates;
  const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`);
  if (!res.ok) throw new Error("Couldn't fetch exchange rates.");
  const d = await res.json();
  if (d?.result !== "success" || !d.rates) throw new Error("Couldn't fetch exchange rates.");
  _cache.set(base, { t: Date.now(), rates: d.rates });
  return d.rates;
}

export async function getRate(from, to) {
  if (!from || !to || from === to) return 1;
  const rates = await ratesFor(from);
  const r = rates[to];
  if (!r || !isFinite(r)) throw new Error("Currency not supported for conversion.");
  return r;
}
