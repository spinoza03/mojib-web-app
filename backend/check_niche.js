const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: rpcData, error } = await supabase.rpc('get_bot_config_by_session', { p_session_name: 'ilyas_nakhil_1027' });
    console.log("RPC Data:", rpcData);
    console.log("RPC Error:", error);
}
check();
