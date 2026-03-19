-- ============================================================
-- Fix user creation: ensure bot_configs table exists and trigger works
-- ============================================================

-- 1. Rename bot_config → bot_configs if the old name still exists
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_config')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='bot_configs')
  THEN
    ALTER TABLE public.bot_config RENAME TO bot_configs;
  END IF;
END $$;

-- 2. Recreate the handle_new_user trigger function with correct table name
--    and proper metadata extraction from auth.users.raw_user_meta_data
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_name TEXT;
  v_phone TEXT;
  v_niche TEXT;
  v_waha_session TEXT;
BEGIN
  -- Extract metadata from signup
  v_clinic_name := COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'My Clinic');
  v_phone := NEW.raw_user_meta_data->>'phone';
  v_niche := COALESCE(NEW.raw_user_meta_data->>'niche', 'dentistry');
  v_waha_session := NEW.raw_user_meta_data->>'waha_session_name';

  -- Insert profile with id = auth user id
  INSERT INTO public.profiles (id, user_id, clinic_name, phone, niche, waha_session_name, plan_type, subscription_status, trial_ends_at)
  VALUES (
    NEW.id,
    NEW.id,
    v_clinic_name,
    v_phone,
    v_niche,
    v_waha_session,
    'pro',
    'trial',
    (now() + interval '7 days')::timestamptz
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert bot_configs (correct table name)
  INSERT INTO public.bot_configs (user_id, system_prompt)
  VALUES (NEW.id, '')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
