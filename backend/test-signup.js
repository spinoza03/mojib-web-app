import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/backend/.env' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testSignup() {
  console.log("Testing user signup directly a new user email...");
  const timestamp = Date.now();
  const { data, error } = await supabase.auth.admin.createUser({
    email: `testuser${timestamp}@example.com`,
    password: 'password123',
    email_confirm: true,
    user_metadata: {
      clinic_name: 'Test Clinic',
      phone: '123456789',
      waha_session_name: 'test-session',
      niche: 'dentistry'
    }
  });

  if (error) {
    console.error("Signup failed with error:");
    console.dir(error, { depth: null });
  } else {
    console.log("Signup succeeded! User ID:", data.user.id);
  }
}

testSignup();
