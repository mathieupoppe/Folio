// Structural palettes per mode. accent/up/down are layered on top.
const DARK = {
  bg: "#0c0e14", surface: "#13161f", card: "#181c28", border: "#252a3d",
  text: "#eef0f8", sub: "#8892b0", hint: "#525870",
};
const LIGHT = {
  bg: "#eceef4", surface: "#f4f5fa", card: "#ffffff", border: "#e0e3ed",
  text: "#1a1d27", sub: "#5c6379", hint: "#9298ad",
};

// selectable accent colors
export const ACCENTS = [
  { key: "blue",   accent: "#5b7fff", accentD: "#3a5ce8" },
  { key: "violet", accent: "#a06bff", accentD: "#7d44e0" },
  { key: "green",  accent: "#3dd68c", accentD: "#22b070" },
  { key: "teal",   accent: "#2fbed6", accentD: "#1d97ab" },
  { key: "orange", accent: "#f0a23c", accentD: "#d4831c" },
  { key: "pink",   accent: "#f0609a", accentD: "#d43d7a" },
];

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
};

export const DEFAULT_THEME = { mode: "dark", accent: "blue", currency: "EUR", language: "en" };

let CUR = CURRENCIES[0]; // active currency

export function applyTheme(mode, accentKey) {
  Object.assign(C, mode === "light" ? LIGHT : DARK);
  const a = ACCENTS.find(x => x.key === accentKey) || ACCENTS[0];
  C.accent = a.accent; C.accentD = a.accentD;
  if (typeof document !== "undefined") document.body.style.background = C.bg;
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
  applyTheme(t.mode, t.accent);
  applyCurrency(t.currency);
}

export const curSymbol = () => CUR.symbol;

export const fmt  = n => CUR.symbol + Math.round(n).toLocaleString(CUR.locale);
export const fmtK = n => {
  if (n >= 1e6) return CUR.symbol + (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return CUR.symbol + (n / 1e3).toFixed(1) + "k";
  return fmt(n);
};
