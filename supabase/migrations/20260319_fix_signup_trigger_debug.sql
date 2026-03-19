-- =========================================================================
-- DEBUG AND FIX SCRIPT FOR USER CREATION
-- Copy and paste ALL of this into the Supabase SQL Editor and run it!
-- =========================================================================

-- 1. Create a debug table to capture EXACTLY why Postgres is rejecting the insert
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Allow public read so we can fetch the logs using JS client to diagnose
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.debug_logs;
CREATE POLICY "Enable read access for all users" ON public.debug_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.debug_logs;
CREATE POLICY "Enable insert access for all users" ON public.debug_logs FOR INSERT WITH CHECK (true);

-- 2. Define the handle_new_user trigger WITH EXCEPTION HANDLING
-- This GUARANTEES the user will be created in auth.users, and it will log 
-- the exact database error to the debug_logs table so we can see why it fails.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_name TEXT;
  v_phone TEXT;
  v_niche TEXT;
  v_waha_session TEXT;
BEGIN
  -- Extract metadata safely
  v_clinic_name := COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'My Clinic');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_niche := COALESCE(NEW.raw_user_meta_data->>'niche', 'dentistry');
  v_waha_session := NEW.raw_user_meta_data->>'waha_session_name';

  -- Try to insert profile
  BEGIN
    INSERT INTO public.profiles (
      id, clinic_name, phone, niche, waha_session_name, plan_type, subscription_status, trial_ends_at
    )
    VALUES (
      NEW.id, v_clinic_name, v_phone, v_niche, v_waha_session, 'pro', 'trial', (now() + interval '7 days')::timestamptz
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs(message) VALUES ('Profiles insert failed: ' || SQLERRM);
  END;

  -- Try to insert bot_config
  BEGIN
    INSERT INTO public.bot_configs (user_id, system_prompt)
    VALUES (NEW.id, '')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    INSERT INTO public.debug_logs(message) VALUES ('Bot_configs insert failed: ' || SQLERRM);
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Ensure the trigger is attached
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
