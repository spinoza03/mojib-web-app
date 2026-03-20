-- =========================================================================
-- Fix: default plan_type safely on signup trigger
-- =========================================================================

-- 0. Ensure the bot_configs table name exists (some migrations used bot_config).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bot_config'
  )
  AND NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'bot_configs'
  ) THEN
    ALTER TABLE public.bot_config RENAME TO bot_configs;
  END IF;
END $$;

-- 1. Ensure profiles has plan_type and defaults expected by the app.
ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'essentiel';

-- 2. Replace handle_new_user with a safe version
--    - Defaults plan_type to `essentiel` when missing
--    - Strips non-digits from phone
--    - Inserts into profiles with/without user_id column depending on schema
--    - Inserts into bot_configs (no crash if already present)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_name TEXT;
  v_phone TEXT;
  v_niche TEXT;
  v_waha_session TEXT;
  v_plan_type TEXT;
  v_has_user_id_column BOOLEAN;
BEGIN
  v_clinic_name := COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'My Clinic');

  v_phone := NEW.raw_user_meta_data->>'phone';
  IF v_phone IS NOT NULL THEN
    v_phone := regexp_replace(v_phone, '\D', '', 'g');
  END IF;

  v_niche := COALESCE(NEW.raw_user_meta_data->>'niche', 'dentistry');
  v_waha_session := NEW.raw_user_meta_data->>'waha_session_name';

  -- CRITICAL: Default plan_type when frontend does not send it.
  v_plan_type := COALESCE(NEW.raw_user_meta_data->>'plan_type', 'essentiel');

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_id'
  ) INTO v_has_user_id_column;

  IF v_has_user_id_column THEN
    INSERT INTO public.profiles (
      id, user_id,
      clinic_name, phone, niche, waha_session_name,
      plan_type, subscription_status, trial_ends_at
    )
    VALUES (
      NEW.id, NEW.id,
      v_clinic_name, v_phone, v_niche, v_waha_session,
      v_plan_type, 'trial', (now() + interval '7 days')::timestamptz
    )
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.profiles (
      id,
      clinic_name, phone, niche, waha_session_name,
      plan_type, subscription_status, trial_ends_at
    )
    VALUES (
      NEW.id,
      v_clinic_name, v_phone, v_niche, v_waha_session,
      v_plan_type, 'trial', (now() + interval '7 days')::timestamptz
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- bot_configs insert (ignore if table doesn't exist yet)
  BEGIN
    INSERT INTO public.bot_configs (user_id, system_prompt)
    VALUES (NEW.id, '')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN
      -- Do nothing: this migration only fixes default plan_type.
      NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

