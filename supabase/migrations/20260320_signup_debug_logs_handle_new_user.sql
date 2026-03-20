-- =========================================================================
-- Signup debug logs
-- =========================================================================

-- 1) Debug table (kept simple for diagnosing signup trigger crashes)
CREATE TABLE IF NOT EXISTS public.debug_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Make sure we can insert/select for debugging (same approach as older debug migration).
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "debug_logs_read_all" ON public.debug_logs;
CREATE POLICY "debug_logs_read_all"
  ON public.debug_logs
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "debug_logs_insert_all" ON public.debug_logs;
CREATE POLICY "debug_logs_insert_all"
  ON public.debug_logs
  FOR INSERT
  WITH CHECK (true);

-- 2) Override handle_new_user to write SQLERRM into debug_logs on failures
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

  v_plan_type := COALESCE(NEW.raw_user_meta_data->>'plan_type', 'essentiel');

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'user_id'
  ) INTO v_has_user_id_column;

  IF v_has_user_id_column THEN
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.debug_logs(message) VALUES ('Profiles insert failed: ' || SQLERRM);
    END;
  ELSE
    BEGIN
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
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.debug_logs(message) VALUES ('Profiles insert failed (no user_id column): ' || SQLERRM);
    END;
  END IF;

  -- bot_configs insert (ignore if table doesn't exist yet)
  BEGIN
    INSERT INTO public.bot_configs (user_id, system_prompt)
    VALUES (NEW.id, '')
    ON CONFLICT (user_id) DO NOTHING;
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN OTHERS THEN
      INSERT INTO public.debug_logs(message) VALUES ('bot_configs insert failed: ' || SQLERRM);
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

