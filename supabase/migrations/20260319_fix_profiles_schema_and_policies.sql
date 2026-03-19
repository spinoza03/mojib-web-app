-- =========================================================================
-- COMPLETE FIX FOR PROFILES (NO user_id) AND BOT CONFIGS
-- Copy and paste ALL of this into the Supabase SQL Editor and run it!
-- =========================================================================

-- 1. Ensure `bot_configs` exists and has all required columns. 
-- (Sometimes it was named bot_config, we make sure bot_configs is fully set up)
CREATE TABLE IF NOT EXISTS public.bot_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  system_prompt TEXT DEFAULT '',
  working_hours TEXT DEFAULT 'Mon-Sat 09:00-18:00',
  tone TEXT DEFAULT 'professional,welcoming',
  languages TEXT DEFAULT 'darija,french',
  additional_info TEXT DEFAULT ''
);

-- Safely add missing columns to bot_configs in case it already existed
ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT '';
ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS working_hours TEXT DEFAULT 'Mon-Sat 09:00-18:00';
ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'professional,welcoming';
ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS languages TEXT DEFAULT 'darija,french';
ALTER TABLE public.bot_configs ADD COLUMN IF NOT EXISTS additional_info TEXT DEFAULT '';

-- 2. Add any missing columns to `profiles` (since it uses `id` for auth.uid)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'clinic';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT 'dentistry';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS waha_session_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'pro';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- 3. Replace the handle_new_user trigger safely! 
-- Note we only insert into `id` for profiles, NEVER `user_id`.
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

  -- Insert profile using id = NEW.id (auth user id)
  -- DO NOT reference user_id in this insert!
  INSERT INTO public.profiles (
    id, clinic_name, phone, niche, waha_session_name, plan_type, subscription_status, trial_ends_at
  )
  VALUES (
    NEW.id,
    v_clinic_name,
    v_phone,
    v_niche,
    v_waha_session,
    'pro',
    'trial',
    (now() + interval '7 days')::timestamptz
  )
  ON CONFLICT (id) DO NOTHING;

  -- Insert bot_configs (this table still uses user_id as its foreign key reference)
  INSERT INTO public.bot_configs (user_id, system_prompt)
  VALUES (NEW.id, '')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate the auth.users trigger just in case
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Fix the recursive RLS Policy on Profiles
-- Drop ANY previous recursive policies
DROP POLICY IF EXISTS "Superusers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create secure get_role function to avoid infinite recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  -- We use 'id' instead of 'user_id' because profiles uses 'id' for the uid reference
  SELECT role INTO _role FROM public.profiles WHERE id = _user_id;
  RETURN _role;
END;
$$;

-- Recreate policies for profiles safely relying ONLY on `id`
CREATE POLICY "Users and Admins can view profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = id
    OR public.get_user_role(auth.uid()) = 'superuser'
  );

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Done!
