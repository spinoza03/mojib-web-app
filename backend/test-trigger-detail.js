import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(SUPABASE_URL, ANON_KEY);

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function debugConstraints() {
  const dummyId = generateUUID();
  console.log("Testing insert into profiles...");
  const { error: pErr } = await supabase.from('profiles').insert({
    id: dummyId,
    clinic_name: 'test',
    phone: '123',
    niche: 'dentistry',
    waha_session_name: 'none',
    plan_type: 'pro',
    subscription_status: 'trial'
  });
  console.log("Profiles Insert Error:", pErr ? pErr.message : pErr, pErr ? pErr.details : '');

  console.log("Testing insert into bot_configs...");
  const { error: bErr } = await supabase.from('bot_configs').insert({
    user_id: dummyId,
    system_prompt: 'test'
  });
  console.log("Bot Configs Insert Error:", bErr ? bErr.message : bErr, bErr ? bErr.details : '');
}

debugConstraints();
