-- =========================================================================
-- COMPLETE FIX: PHONE FORMATTING + NEW USER SIGNUP
-- Copy and paste ALL of this into the Supabase SQL Editor and run it!
-- =========================================================================

-- 1. Fix all existing phone numbers that contain spaces or + signs 
-- This is why the AI agent was staying silent! The webhook was looking for 
-- pure digits (e.g. 212600) but finding spaces in the DB (+212 600).
UPDATE public.profiles 
SET phone = regexp_replace(COALESCE(phone, ''), '\D', '', 'g') 
WHERE phone IS NOT NULL;

-- 2. Create the fixed trigger to secure future sign-ups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_name TEXT;
  v_phone TEXT;
  v_niche TEXT;
  v_waha_session TEXT;
BEGIN
  v_clinic_name := COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'My Clinic');
  
  -- Strip non-digits from the phone automatically!
  v_phone := NEW.raw_user_meta_data->>'phone';
  IF v_phone IS NOT NULL THEN
    v_phone := regexp_replace(v_phone, '\D', '', 'g');
  END IF;

  v_niche := COALESCE(NEW.raw_user_meta_data->>'niche', 'dentistry');
  v_waha_session := NEW.raw_user_meta_data->>'waha_session_name';

  -- Insert profile using IF NOT EXISTS
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (
      id, clinic_name, phone, niche, waha_session_name, plan_type, subscription_status, trial_ends_at
    )
    VALUES (
      NEW.id, v_clinic_name, v_phone, v_niche, v_waha_session, 'pro', 'trial', (now() + interval '7 days')::timestamptz
    );
  END IF;

  -- Insert bot_config using IF NOT EXISTS to avoid ON CONFLICT errors
  IF NOT EXISTS (SELECT 1 FROM public.bot_configs WHERE user_id = NEW.id) THEN
    INSERT INTO public.bot_configs (user_id, system_prompt)
    VALUES (NEW.id, '');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Safely add the UNIQUE constraint to bot_configs to prevent the trigger crash
DO $$ 
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'bot_configs_user_id_key'
  ) THEN
      ALTER TABLE public.bot_configs ADD CONSTRAINT bot_configs_user_id_key UNIQUE (user_id);
  END IF;
END $$;
