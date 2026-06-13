import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

// true once you've filled in .env with your project's URL + anon key
export const isConfigured = Boolean(url && key);

// null until configured — the app shows a setup notice instead of crashing
export const supabase = isConfigured ? createClient(url, key) : null;
