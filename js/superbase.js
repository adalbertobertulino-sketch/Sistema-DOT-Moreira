// js/supabase.js
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 1) Cole AQUI sua URL do Supabase (Settings > API > Project URL)
const SUPABASE_URL = "COLE_SUA_SUPABASE_URL_AQUI";

// 2) Cole AQUI sua anon public key (Settings > API > anon public)
const SUPABASE_ANON_KEY = "COLE_SUA_ANON_KEY_AQUI";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
