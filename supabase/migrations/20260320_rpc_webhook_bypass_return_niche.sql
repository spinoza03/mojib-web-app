-- =========================================================================
-- Return niche in RPC response (needed to switch prompts)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_bot_config_by_session(p_session_name TEXT)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile RECORD;
  v_config RECORD;
  v_result json;
BEGIN
  -- 1. Get profile by session name (now includes niche)
  SELECT id, clinic_name, subscription_status, waha_session_name, niche
  INTO v_profile
  FROM public.profiles
  WHERE waha_session_name = p_session_name
  LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Get bot config
  SELECT system_prompt, cooldown_seconds, working_hours, tone, languages, additional_info
  INTO v_config
  FROM public.bot_configs
  WHERE user_id = v_profile.id
  LIMIT 1;

  -- 3. Return JSON object
  v_result := json_build_object(
    'user_id', v_profile.id,
    'clinic_name', v_profile.clinic_name,
    'subscription_status', v_profile.subscription_status,
    'waha_session_name', v_profile.waha_session_name,
    'niche', COALESCE(v_profile.niche, 'dentistry'),
    'system_prompt', COALESCE(v_config.system_prompt, ''),
    'cooldown_seconds', COALESCE(v_config.cooldown_seconds, 60),
    'working_hours', COALESCE(v_config.working_hours, 'Mon-Sat 09:00-18:00'),
    'tone', COALESCE(v_config.tone, 'professional,welcoming'),
    'languages', COALESCE(v_config.languages, 'darija,french'),
    'additional_info', COALESCE(v_config.additional_info, '')
  );

  RETURN v_result;
END;
$$;

