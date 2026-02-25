import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://ylgjxbhdekmswsspypwc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JePmAgOrJQuo0ct77-rqHA_Mfv7yQjJ";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
