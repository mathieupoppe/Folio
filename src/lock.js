// Device-local app lock (convenience PIN). Not synced — it guards this device.
// The account password is the real security boundary; this just adds a quick
// gate. Biometric / Face ID unlock will layer on with the native (Capacitor) build.
const KEY = "folio-lock";

export function readLock() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null") || { enabled: false, pin: "" }; }
  catch { return { enabled: false, pin: "" }; }
}
export function writeLock(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch {} }

// Light obfuscation of the PIN (a 4-digit PIN can't be truly secured client-side;
// this just avoids storing it in plain text).
export function hashPin(pin) {
  let h = 0;
  const s = "folio:" + pin;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function lockActive() {
  const l = readLock();
  return !!(l.enabled && l.pin);
}
