const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/neora-connect/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log("Testing profile insert...");
  const { error: pErr } = await supabase.from('profiles').insert({
    id: '00000000-0000-0000-0000-000000000000',
    clinic_name: 'test',
    phone: 'test',
    niche: 'dentistry',
    waha_session_name: 'test',
    plan_type: 'pro',
    subscription_status: 'trial'
  });
  console.log("Profiles insert error:", pErr);

  console.log("Testing bot_configs insert...");
  const { error: bErr } = await supabase.from('bot_configs').insert({
    user_id: '00000000-0000-0000-0000-000000000000',
    system_prompt: 'test'
  });
  console.log("bot_configs insert error:", bErr);
}
check();
