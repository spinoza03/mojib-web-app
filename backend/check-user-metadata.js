import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '/root/neora-connect/.env' });

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

async function testMetadata() {
  const email = `test-${generateUUID()}@example.com`;
  console.log("Signing up:", email);
  const { data, error } = await supabase.auth.signUp({
      email,
      password: 'password123',
      options: {
          data: {
              clinic_name: 'TEST_CLINIC',
              phone: '+212 600 000 000',
              niche: 'dentistry',
              waha_session_name: 'session_test_123'
          }
      }
  });
  
  if (error) {
      console.error("Signup failed:", error);
      return;
  }
  
  console.log("User Metadata received:", data.user?.user_metadata);
  
  // Now since we are signed in (assuming auto-signin works), let's query our profile!
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
  console.log("Resulting Profile format:", profile);
  
  // Test update!
  console.log("Testing DB update as the UI does in ConnectPage.tsx...");
  const updateRes = await supabase.from('profiles').update({ whatsapp_status: 'connected', phone: '212600111222' }).eq('id', data.user.id);
  console.log("Update error?", updateRes.error);
  
  const { data: profileAfter } = await supabase.from('profiles').select('*').eq('id', data.user.id).single();
  console.log("Profile AFTER update:", profileAfter);
}

testMetadata();
