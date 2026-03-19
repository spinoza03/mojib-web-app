const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/neora-connect/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: profs, error: e1 } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles error:', e1);
  console.log('Profiles columns:', profs && profs.length > 0 ? Object.keys(profs[0]) : 'No data');

  const { data: bots, error: e2 } = await supabase.from('bot_configs').select('*').limit(1);
  console.log('Bot Configs error:', e2);
  console.log('Bot Configs columns:', bots && bots.length > 0 ? Object.keys(bots[0]) : 'No data');
}
check();
