import { supabase } from "./supabase";

// One row per user in table "folio": { user_id (uuid, pk), data (jsonb), updated_at }
// Holds the whole plan: { settings: {...}, entries: [...] }

// Returns { data, updatedAt } so callers can do last-write-wins conflict checks.
export async function fetchData(userId) {
  const { data, error } = await supabase
    .from("folio")
    .select("data, updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return { data: data?.data ?? null, updatedAt: data?.updated_at ?? null };
}

// Lightweight read of just the server timestamp, for pre-save conflict detection.
export async function fetchUpdatedAt(userId) {
  const { data, error } = await supabase
    .from("folio")
    .select("updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.updated_at ?? null;
}

// Saves the blob and returns the new updated_at it wrote.
export async function saveData(userId, blob) {
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from("folio")
    .upsert({ user_id: userId, data: blob, updated_at: updatedAt });
  if (error) throw error;
  return updatedAt;
}

// Conflict-aware save. If the server row is newer than what this client last
// saw (another device wrote in the meantime), it does NOT overwrite — it
// reports the conflict so the caller can re-hydrate instead of clobbering.
export async function saveDataSafe(userId, blob, lastKnownUpdatedAt) {
  const remote = await fetchUpdatedAt(userId);
  if (remote && lastKnownUpdatedAt && remote > lastKnownUpdatedAt) {
    return { conflict: true, remoteUpdatedAt: remote };
  }
  const updatedAt = await saveData(userId, blob);
  return { conflict: false, updatedAt };
}
