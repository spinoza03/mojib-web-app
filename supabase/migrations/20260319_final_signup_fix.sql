-- =========================================================================
-- FINAL TRIGGER FIX (Removes dependency on broken UNIQUE constraints)
-- Copy and paste ALL of this into the Supabase SQL Editor and run it!
-- =========================================================================

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
  -- (This fixes the exact crash found in the debug_logs)
  IF NOT EXISTS (SELECT 1 FROM public.bot_configs WHERE user_id = NEW.id) THEN
    INSERT INTO public.bot_configs (user_id, system_prompt)
    VALUES (NEW.id, '');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Also adding the UNIQUE constraint safely to bot_configs to prevent future issues
ALTER TABLE public.bot_configs ADD CONSTRAINT bot_configs_user_id_key UNIQUE (user_id);
