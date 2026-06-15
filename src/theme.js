// Structural palettes per mode. accent/up/down are layered on top.
// Premium depth tokens: cardTop/card give cards a soft top-to-bottom gradient,
// shadow/shadowSm add elevation, hi is an inset top-edge highlight, glass is the
// translucent bottom-nav fill.
const DARK = {
  bg: "#080a11", surface: "#11141d", card: "#171b27", cardTop: "#1c2231", border: "#2a3145",
  text: "#f1f3fb", sub: "#9aa3bd", hint: "#5b6279",
  shadow: "0 18px 40px -20px rgba(0,0,0,0.75), 0 4px 14px -8px rgba(0,0,0,0.55)",
  shadowSm: "0 8px 20px -12px rgba(0,0,0,0.6)",
  hi: "inset 0 1px 0 rgba(255,255,255,0.06)",
  glass: "rgba(12,15,23,0.72)",
};
const LIGHT = {
  bg: "#eceef5", surface: "#f5f6fb", card: "#ffffff", cardTop: "#ffffff", border: "#e4e7f1",
  text: "#171a24", sub: "#5a6178", hint: "#959cb0",
  shadow: "0 16px 36px -18px rgba(28,40,80,0.20), 0 4px 12px -6px rgba(28,40,80,0.10)",
  shadowSm: "0 8px 20px -12px rgba(28,40,80,0.16)",
  hi: "inset 0 1px 0 rgba(255,255,255,0.9)",
  glass: "rgba(255,255,255,0.72)",
};

// A few quick presets — the color wheel covers everything else.
export const ACCENTS = [
  { key: "red",    accent: "#f0565b", accentD: "#d23a40" },
  { key: "orange", accent: "#f0a23c", accentD: "#d4831c" },
  { key: "green",  accent: "#3dd68c", accentD: "#22b070" },
  { key: "teal",   accent: "#2fbed6", accentD: "#1d97ab" },
  { key: "blue",   accent: "#5b7fff", accentD: "#3a5ce8" },
  { key: "violet", accent: "#a06bff", accentD: "#7d44e0" },
  { key: "pink",   accent: "#f0609a", accentD: "#d43d7a" },
];

// darken a #rrggbb (or #rgb) hex by a fraction — used to derive the gradient
// end-color for a custom accent the user picks.
export function darken(hex, amt = 0.2) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6) return hex;
  const ch = i => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * (1 - amt))));
  return "#" + [0, 2, 4].map(i => ch(i).toString(16).padStart(2, "0")).join("");
}

// selectable currencies — the most-traded / most-used worldwide
export const CURRENCIES = [
  { code: "USD", symbol: "$",   locale: "en-US", label: "US Dollar" },
  { code: "EUR", symbol: "€",   locale: "fr-BE", label: "Euro" },
  { code: "GBP", symbol: "£",   locale: "en-GB", label: "British Pound" },
  { code: "JPY", symbol: "¥",   locale: "ja-JP", label: "Japanese Yen" },
  { code: "CNY", symbol: "CN¥", locale: "zh-CN", label: "Chinese Yuan" },
  { code: "AUD", symbol: "A$",  locale: "en-AU", label: "Australian Dollar" },
  { code: "CAD", symbol: "C$",  locale: "en-CA", label: "Canadian Dollar" },
  { code: "CHF", symbol: "Fr",  locale: "de-CH", label: "Swiss Franc" },
  { code: "HKD", symbol: "HK$", locale: "zh-HK", label: "Hong Kong Dollar" },
  { code: "SGD", symbol: "S$",  locale: "en-SG", label: "Singapore Dollar" },
  { code: "INR", symbol: "₹",   locale: "en-IN", label: "Indian Rupee" },
  { code: "BRL", symbol: "R$",  locale: "pt-BR", label: "Brazilian Real" },
];

// selectable interface languages (most-used in apps). Translation rolls out over time.
export const LANGUAGES = [
  { code: "en", label: "English",    native: "English" },
  { code: "nl", label: "Dutch",      native: "Nederlands" },
  { code: "fr", label: "French",     native: "Français" },
  { code: "de", label: "German",     native: "Deutsch" },
  { code: "es", label: "Spanish",    native: "Español" },
  { code: "it", label: "Italian",    native: "Italiano" },
  { code: "pt", label: "Portuguese", native: "Português" },
  { code: "ru", label: "Russian",    native: "Русский" },
  { code: "tr", label: "Turkish",    native: "Türkçe" },
  { code: "pl", label: "Polish",     native: "Polski" },
  { code: "zh", label: "Chinese",    native: "中文" },
  { code: "ja", label: "Japanese",   native: "日本語" },
  { code: "ko", label: "Korean",     native: "한국어" },
  { code: "ar", label: "Arabic",     native: "العربية" },
  { code: "hi", label: "Hindi",      native: "हिन्दी" },
];

// the live theme object every component reads (mutated in place by applyTheme)
export const C = {
  up: "#3dd68c", down: "#f05c5c",
  ...DARK, accent: "#5b7fff", accentD: "#3a5ce8",
  cardGrad: "", accentGrad: "", glow: "", bgGlow: "",
};

export const DEFAULT_THEME = { mode: "dark", accent: "blue", currency: "EUR", language: "en" };

let CUR = CURRENCIES[0]; // active currency

export function applyTheme(mode, accentKey, customHex) {
  const isLight = mode === "light";
  Object.assign(C, isLight ? LIGHT : DARK);
  if (accentKey === "custom" && customHex) {
    C.accent = customHex; C.accentD = darken(customHex, 0.22);
  } else {
    const a = ACCENTS.find(x => x.key === accentKey) || ACCENTS.find(x => x.key === "blue");
    C.accent = a.accent; C.accentD = a.accentD;
  }
  // derived premium tokens (depend on the freshly-assigned mode + accent)
  C.cardGrad = `linear-gradient(180deg, ${C.cardTop}, ${C.card})`;
  C.accentGrad = `linear-gradient(135deg, ${C.accent}, ${C.accentD})`;
  C.glow = `0 10px 26px -10px ${C.accent}${isLight ? "59" : "6e"}`;
  // soft pools of accent light behind the page — subtle, never garish
  C.bgGlow = isLight
    ? `radial-gradient(900px 480px at 50% -8%, ${C.accent}1f, transparent 62%), radial-gradient(700px 420px at 100% 8%, ${C.accent}14, transparent 60%)`
    : `radial-gradient(900px 520px at 50% -10%, ${C.accent}24, transparent 60%), radial-gradient(760px 460px at 100% 6%, ${C.accent}16, transparent 58%)`;
  if (typeof document !== "undefined") {
    document.body.style.background = C.bg;
    document.body.style.backgroundImage = C.bgGlow;
    document.body.style.backgroundAttachment = "fixed";
  }
}

export function applyCurrency(code) {
  CUR = CURRENCIES.find(c => c.code === code) || CURRENCIES[0];
}

// load saved theme before first paint
export function loadTheme() {
  try {
    const t = JSON.parse(localStorage.getItem("folio-theme") || "null");
    if (t && t.mode) return { ...DEFAULT_THEME, ...t };
  } catch {}
  return DEFAULT_THEME;
}

// apply immediately at module load so the first render is correct
{
  const t = loadTheme();
  applyTheme(t.mode, t.accent, t.customAccent);
  applyCurrency(t.currency);
}

export const curSymbol = () => CUR.symbol;

export const fmt  = n => CUR.symbol + Math.round(n).toLocaleString(CUR.locale);
export const fmtK = n => {
  if (n >= 1e6) return CUR.symbol + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return CUR.symbol + (n / 1e3).toFixed(1) + "k";
  return fmt(n);
};
