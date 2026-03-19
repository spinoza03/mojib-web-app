const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/neora-connect/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  const { data: p } = await supabase.from('profiles').select().limit(1);
  console.log('profiles cols:', p && p.length > 0 ? Object.keys(p[0]) : p);
  
  const { data: bc } = await supabase.from('bot_config').select().limit(1);
  console.log('table: bot_config cols:', bc && bc.length > 0 ? Object.keys(bc[0]) : bc);
  
  const { data: bcs } = await supabase.from('bot_configs').select().limit(1);
  console.log('table: bot_configs cols:', bcs && bcs.length > 0 ? Object.keys(bcs[0]) : bcs);
}
check();
