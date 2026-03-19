-- 1. Drop the recursive policy that is causing the crashes
DROP POLICY IF EXISTS "Superusers can view all profiles" ON public.profiles;

-- 2. Create a secure function to check roles without triggering infinite loops
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  -- Because this function is SECURITY DEFINER, it runs as Postgres and bypasses RLS
  SELECT role INTO _role FROM public.profiles WHERE user_id = _user_id;
  RETURN _role;
END;
$$;

-- 3. Recreate the policy safely using the function
CREATE POLICY "Superusers can view all profiles"
  ON public.profiles FOR SELECT
  USING (
    auth.uid() = user_id
    OR public.get_user_role(auth.uid()) = 'superuser'
  );
  
-- 4. Ensure all newly required columns exist (to prevent other crash causes)
ALTER TABLE IF EXISTS public.bot_configs ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT '';
ALTER TABLE IF EXISTS public.bot_configs ADD COLUMN IF NOT EXISTS working_hours TEXT DEFAULT 'Mon-Sat 09:00-18:00';
ALTER TABLE IF EXISTS public.bot_configs ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT 'professional,welcoming';
ALTER TABLE IF EXISTS public.bot_configs ADD COLUMN IF NOT EXISTS languages TEXT DEFAULT 'darija,french';
ALTER TABLE IF EXISTS public.bot_configs ADD COLUMN IF NOT EXISTS additional_info TEXT DEFAULT '';

ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'clinic';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS niche TEXT DEFAULT 'dentistry';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS waha_session_name TEXT;
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'pro';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'trial';
ALTER TABLE IF EXISTS public.profiles ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
