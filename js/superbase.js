import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ylgjxbhdekmwssspypwc.supabase.co";
const SUPABASE_ANON_KEY = "COLE_AQUI_SUA_ANON_KEY";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
