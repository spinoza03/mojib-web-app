const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '/root/neora-connect/backend/.env' });
async function run() {
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await supabase.from('bot_configs').select('*').limit(1);
  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Data:', JSON.stringify(data[0], null, 2));
  }
  
  const { data: hist, error: err2 } = await supabase.from('chat_history1').select('*').limit(1);
  if (err2) {
    console.log('History Error:', err2.message);
  } else {
    console.log('History ok');
  }
}
run();
