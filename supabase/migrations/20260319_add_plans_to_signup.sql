-- =========================================================================
-- UPDATE: PHONE FORMATTING + NEW USER SIGNUP WITH PLANS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_clinic_name TEXT;
  v_phone TEXT;
  v_niche TEXT;
  v_waha_session TEXT;
  v_plan_type TEXT;
BEGIN
  v_clinic_name := COALESCE(NEW.raw_user_meta_data->>'clinic_name', 'My Clinic');
  
  -- Strip non-digits from the phone automatically!
  v_phone := NEW.raw_user_meta_data->>'phone';
  IF v_phone IS NOT NULL THEN
    v_phone := regexp_replace(v_phone, '\D', '', 'g');
  END IF;

  v_niche := COALESCE(NEW.raw_user_meta_data->>'niche', 'dentistry');
  v_waha_session := NEW.raw_user_meta_data->>'waha_session_name';
  v_plan_type := COALESCE(NEW.raw_user_meta_data->>'plan_type', 'essentiel');

  -- Insert profile using IF NOT EXISTS
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    INSERT INTO public.profiles (
      id, user_id, clinic_name, phone, niche, waha_session_name, plan_type, subscription_status, trial_ends_at
    )
    VALUES (
      NEW.id, NEW.id, v_clinic_name, v_phone, v_niche, v_waha_session, v_plan_type, 'trial', (now() + interval '7 days')::timestamptz
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
