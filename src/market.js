// Live market data via CoinGecko's free public API (CORS-enabled, no key).
// Covers crypto + tokenized commodities (e.g. gold via PAX Gold). Stocks/ETFs
// would need a licensed provider later (Finnhub / Twelve Data) behind an edge
// function — see the watchlist notes.

// Curated assets the user can add (CoinGecko ids).
export const WATCH_ASSETS = [
  { id: "bitcoin",      name: "Bitcoin",   symbol: "BTC",  kind: "Crypto" },
  { id: "ethereum",     name: "Ethereum",  symbol: "ETH",  kind: "Crypto" },
  { id: "solana",       name: "Solana",    symbol: "SOL",  kind: "Crypto" },
  { id: "ripple",       name: "XRP",       symbol: "XRP",  kind: "Crypto" },
  { id: "cardano",      name: "Cardano",   symbol: "ADA",  kind: "Crypto" },
  { id: "dogecoin",     name: "Dogecoin",  symbol: "DOGE", kind: "Crypto" },
  { id: "binancecoin",  name: "BNB",       symbol: "BNB",  kind: "Crypto" },
  { id: "polkadot",     name: "Polkadot",  symbol: "DOT",  kind: "Crypto" },
  { id: "chainlink",    name: "Chainlink", symbol: "LINK", kind: "Crypto" },
  { id: "litecoin",     name: "Litecoin",  symbol: "LTC",  kind: "Crypto" },
  { id: "avalanche-2",  name: "Avalanche", symbol: "AVAX", kind: "Crypto" },
  { id: "matic-network",name: "Polygon",   symbol: "POL",  kind: "Crypto" },
  { id: "pax-gold",     name: "Gold",      symbol: "XAU",  kind: "Commodity" },
  { id: "tether-gold",  name: "Gold (alt)",symbol: "XAUt", kind: "Commodity" },
];

// Short-lived in-memory cache so rapid remounts (home widget ↔ full page) and
// reloads reuse data instead of hammering CoinGecko's free rate limit.
const _cache = new Map(); // key -> { t, data }
const TTL = 30000;

// Fetch live quotes (price, 24h % change, 7-day sparkline) for the given ids,
// priced in the user's currency.
export async function fetchQuotes(ids, vs = "eur") {
  if (!ids || ids.length === 0) return [];
  const key = vs.toLowerCase() + "|" + [...ids].sort().join(",");
  const hit = _cache.get(key);
  if (hit && Date.now() - hit.t < TTL) return hit.data;
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${encodeURIComponent(vs.toLowerCase())}` +
    `&ids=${ids.join(",")}&sparkline=true&price_change_percentage=24h`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status === 429 ? "Rate limited — try again in a moment." : "Couldn't load prices.");
  const data = await r.json();
  const result = data.map(d => ({
    id: d.id,
    name: d.name,
    symbol: (d.symbol || "").toUpperCase(),
    price: d.current_price,
    change24h: d.price_change_percentage_24h,
    spark: d.sparkline_in_7d?.price || [],
    image: d.image,
  }));
  _cache.set(key, { t: Date.now(), data: result });
  return result;
}
