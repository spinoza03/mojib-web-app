import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zlkbeklravpsafnmyyqs.supabase.co';
const ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_4vayUau5Hj2AJIps8MfiAw_oy83z52K';

const supabase = createClient(SUPABASE_URL, ANON_KEY);

async function testSignup() {
  console.log("Testing user signup using auth.signUp...");
  const timestamp = Date.now();
  const { data, error } = await supabase.auth.signUp({
    email: `testuser${timestamp}@example.com`,
    password: 'password123',
    options: {
      data: {
        clinic_name: 'Test Clinic',
        phone: '123456789',
        waha_session_name: 'test-session',
        niche: 'dentistry'
      }
    }
  });

  if (error) {
    console.error("Signup failed with error:");
    console.dir(error, { depth: null });
  } else {
    console.log("Signup succeeded! User ID:", data.user?.id);
  }
}

testSignup();
