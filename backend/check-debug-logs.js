import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function fetchLogs() {
  console.log("Fetching debug_logs to see trigger execution result...");
  const { data, error } = await supabase.from('debug_logs').select('*').order('created_at', { ascending: false }).limit(20);

  if (error) {
    console.error("Could not fetch debug logs. Did the SQL script run? Error:", error.message);
  } else {
    console.log("Recent debug_logs:");
    console.dir(data, { depth: null });
  }
}

fetchLogs();
