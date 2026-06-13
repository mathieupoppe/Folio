import { supabase } from "./supabase";

// One row per user in table "folio": { user_id (uuid, pk), data (jsonb), updated_at }
// Holds the whole plan: { settings: {...}, entries: [...] }

export async function fetchData(userId) {
  const { data, error } = await supabase
    .from("folio")
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

export async function saveData(userId, blob) {
  const { error } = await supabase
    .from("folio")
    .upsert({ user_id: userId, data: blob, updated_at: new Date().toISOString() });
  if (error) throw error;
}
