const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '/root/neora-connect/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // We can use the service role key to bypass RLS, but wait, the error happens even with service role?
  // Let's run a raw SQL query using RPC if we have one, or just fetch the columns using postgrest
  
  // Actually, we can just get the columns from information_schema via RPC, but we'd need a function for it.
  // Instead, let's just make an HTTP request to the PostgREST endpoint directly with OPTIONS to get the OpenAPI spec, which contains the schema!

  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    }
  });
  
  const swagger = await response.json();
  const profiles = swagger.definitions.profiles.properties;
  console.log('Profiles columns:', Object.keys(profiles));
  
  const bots = swagger.definitions.bot_configs || swagger.definitions.bot_config;
  console.log('Bot Configs columns:', bots ? Object.keys(bots.properties) : 'Not found');
}
check();
