import { supabase } from "./supabase";

// ─────────────────────────────────────────────────────────────────────────────
// Web Push subscription helpers. The user opts in (Settings → Notifications);
// we register the service worker, ask permission, subscribe with our VAPID
// public key, and store the subscription so the `notify` edge function can push
// money-moment alerts when the app is closed.
//
// iOS note: web push only works when Folio is installed to the Home Screen
// (iOS 16.4+). Native push (Capacitor/FCM) replaces this in the native build.
// ─────────────────────────────────────────────────────────────────────────────

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export const pushSupported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export const pushConfigured = () => Boolean(VAPID_PUBLIC);

// Current state without prompting: "unsupported" | "unconfigured" | "denied" | "off" | "on"
export async function pushState() {
  if (!pushSupported()) return "unsupported";
  if (!pushConfigured()) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    return sub ? "on" : "off";
  } catch { return "off"; }
}

function urlBase64ToUint8Array(base64) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

// Opt in. Returns the resulting state ("on", "denied", …). Throws on real errors.
export async function enablePush(userId) {
  if (!pushSupported()) return "unsupported";
  if (!pushConfigured()) return "unconfigured";
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";

  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register("/sw.js"));
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert({
    endpoint: json.endpoint,
    user_id: userId,
    keys: json.keys,
  });
  if (error) throw error;
  return "on";
}

// Opt out: unsubscribe locally and remove the row.
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = reg ? await reg.pushManager.getSubscription() : null;
    if (sub) {
      await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
  } catch { /* best effort */ }
  return "off";
}
