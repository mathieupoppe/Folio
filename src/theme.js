// Monochrome (getquin-style) palettes. True black, white text, grey subtext.
// Color is reserved for up/down only. Cards are near-black with hairline borders
// and almost no elevation — flat and clean.
const DARK = {
  bg: "#000000", surface: "#0d0d0f", card: "#111113", cardTop: "#141416", border: "#242427",
  text: "#ffffff", sub: "#9a9aa1", hint: "#646469",
  shadow: "0 1px 0 rgba(255,255,255,0.02)",
  shadowSm: "none",
  hi: "none",
  glass: "rgba(0,0,0,0.78)",
};
const LIGHT = {
  bg: "#ffffff", surface: "#f5f5f7", card: "#ffffff", cardTop: "#ffffff", border: "#e6e6ea",
  text: "#0a0a0b", sub: "#6b6b73", hint: "#9a9aa1",
  shadow: "0 1px 2px rgba(0,0,0,0.05)",
  shadowSm: "none",
  hi: "none",
  glass: "rgba(255,255,255,0.82)",
};

// Accent is monochrome now (white on dark, black on light). Kept as a 1-entry
// list so any remaining references resolve; the picker UI has been removed.
export const ACCENTS = [
  { key: "mono", accent: "#f5f5f7", accentD: "#d4d4d8" },
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

// the live theme object every component reads (mutated in place by applyTheme).
// onAccent = text/icon color that sits ON an accent fill (black on the white
// dark-mode accent, white on the black light-mode accent).
export const C = {
  up: "#30d158", down: "#ff453a",
  ...DARK, accent: "#f5f5f7", accentD: "#d4d4d8", onAccent: "#000000",
  cardGrad: "", accentGrad: "", glow: "", bgGlow: "",
};

export const DEFAULT_THEME = { mode: "dark", accent: "mono", currency: "EUR", language: "en" };

let CUR = CURRENCIES[0]; // active currency

export function applyTheme(mode, accentKey, customHex) { // eslint-disable-line no-unused-vars
  const isLight = mode === "light";
  Object.assign(C, isLight ? LIGHT : DARK);
  // Monochrome accent: white on dark, near-black on light. Text on the accent
  // fill is the inverse so white CTA pills read with black text (getquin style).
  C.accent = isLight ? "#0a0a0b" : "#f5f5f7";
  C.accentD = isLight ? "#26262a" : "#d4d4d8";
  C.onAccent = isLight ? "#ffffff" : "#000000";
  // flat, monochrome — no gradients, no glow, no accent light pools
  C.cardGrad = C.card;
  C.accentGrad = C.accent;
  C.glow = "none";
  C.bgGlow = "none";
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
