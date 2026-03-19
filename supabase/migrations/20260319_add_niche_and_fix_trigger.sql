-- ============================================================
-- 1. Add niche column to profiles
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='niche') THEN
    ALTER TABLE public.profiles ADD COLUMN niche TEXT NOT NULL DEFAULT 'dentistry';
  END IF;
END $$;

-- ============================================================
-- 2. Add structured config fields to bot_configs
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='working_hours') THEN
    ALTER TABLE public.bot_configs ADD COLUMN working_hours TEXT DEFAULT 'Mon-Sat 09:00-18:00';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='tone') THEN
    ALTER TABLE public.bot_configs ADD COLUMN tone TEXT DEFAULT 'professional,welcoming';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='languages') THEN
    ALTER TABLE public.bot_configs ADD COLUMN languages TEXT DEFAULT 'darija,french';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='bot_configs' AND column_name='additional_info') THEN
    ALTER TABLE public.bot_configs ADD COLUMN additional_info TEXT DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- 3. Fix handle_new_user trigger to read metadata properly
--    - Sets profiles.id = auth user id (so frontend .eq('id', user.id) works)
--    - Reads clinic_name, phone, niche, waha_session_name from metadata
--    - Sets default plan_type, subscription_status, trial_ends_at
-- ============================================================
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

  -- Insert bot_configs
  INSERT INTO public.bot_configs (user_id, system_prompt)
  VALUES (NEW.id, '')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================
-- 4. Add superuser RLS policies so admin can read all profiles
-- ============================================================
DO $$ BEGIN
  -- Allow superusers to view all profiles
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Superusers can view all profiles'
  ) THEN
    CREATE POLICY "Superusers can view all profiles"
      ON public.profiles FOR SELECT
      USING (
        auth.uid() = user_id
        OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'superuser')
      );
  END IF;
END $$;
