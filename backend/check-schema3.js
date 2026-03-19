import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function checkCols() {
  const pRes = await supabase.from('profiles').select('niche, waha_session_name, plan_type, subscription_status, trial_ends_at, role').limit(1);
  console.log("Profiles columns check:", pRes.error ? pRes.error.message : "All columns exist!");

  const bcRes = await supabase.from('bot_configs').select('system_prompt, user_id, working_hours, tone, languages, additional_info').limit(1);
  console.log("Bot Configs columns check:", bcRes.error ? bcRes.error.message : "All columns exist!");

  const bcOldRes = await supabase.from('bot_config').select('*').limit(1);
  console.log("Old bot_config check:", bcOldRes.error ? bcOldRes.error.message : (bcOldRes.data ? "Exists" : "Null"));
}

checkCols();
