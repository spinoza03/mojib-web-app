-- ============================================================
-- 1. Add 'no_show' and 'completed' to appointment statuses
-- 2. Add share_token to profiles for public booking links
-- 3. Add DELETE policy for appointments
-- ============================================================

-- 1. Add attendance tracking status values
-- The status column is TEXT, so we just need to handle it in the app.
-- Add a comment documenting valid statuses for clarity.
COMMENT ON COLUMN public.appointments.status IS 'Valid values: pending, confirmed, cancelled, completed, no_show';

-- 2. Add share_token to profiles for public booking links
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS share_token UUID DEFAULT gen_random_uuid();

-- Create unique index on share_token for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_share_token ON public.profiles(share_token);

-- 3. Add RPC function for public booking (no auth required, uses share_token)
CREATE OR REPLACE FUNCTION public.get_public_booking_config(p_share_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'user_id', p.id,
        'clinic_name', p.clinic_name,
        'niche', p.niche,
        'working_hours', bc.working_hours,
        'slot_interval_minutes', bc.slot_interval_minutes,
        'slot_capacity', bc.slot_capacity
    ) INTO result
    FROM profiles p
    LEFT JOIN bot_configs bc ON bc.user_id = p.id
    WHERE p.share_token = p_share_token
      AND p.subscription_status IN ('pro', 'trial', 'active');

    RETURN result;
END;
$$;

-- 4. RPC to get available slots for public booking
CREATE OR REPLACE FUNCTION public.get_public_available_slots(p_share_token UUID, p_date DATE)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_working_hours TEXT;
    v_slot_interval INT;
    v_slot_capacity INT;
    result JSON;
BEGIN
    SELECT p.id, bc.working_hours, bc.slot_interval_minutes, bc.slot_capacity
    INTO v_user_id, v_working_hours, v_slot_interval, v_slot_capacity
    FROM profiles p
    LEFT JOIN bot_configs bc ON bc.user_id = p.id
    WHERE p.share_token = p_share_token
      AND p.subscription_status IN ('pro', 'trial', 'active');

    IF v_user_id IS NULL THEN
        RETURN '[]'::json;
    END IF;

    -- Return existing appointments for that date so frontend can compute available slots
    SELECT json_agg(json_build_object(
        'start_time', a.start_time,
        'end_time', a.end_time,
        'status', a.status
    ))
    INTO result
    FROM appointments a
    WHERE a.doctor_id = v_user_id
      AND a.start_time::date = p_date
      AND a.status NOT IN ('cancelled', 'no_show');

    RETURN COALESCE(result, '[]'::json);
END;
$$;

-- 5. RPC to insert appointment from public booking page
CREATE OR REPLACE FUNCTION public.book_public_appointment(
    p_share_token UUID,
    p_patient_name TEXT,
    p_patient_phone TEXT,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_notes TEXT DEFAULT ''
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_apt_id UUID;
BEGIN
    SELECT p.id INTO v_user_id
    FROM profiles p
    WHERE p.share_token = p_share_token
      AND p.subscription_status IN ('pro', 'trial', 'active');

    IF v_user_id IS NULL THEN
        RETURN json_build_object('error', 'Invalid or expired booking link');
    END IF;

    INSERT INTO appointments (doctor_id, patient_name, patient_phone, start_time, end_time, notes, status)
    VALUES (v_user_id, p_patient_name, p_patient_phone, p_start_time, p_end_time, p_notes, 'confirmed')
    RETURNING id INTO v_apt_id;

    RETURN json_build_object('success', true, 'appointment_id', v_apt_id);
END;
$$;

-- 6. Add DELETE policy for appointments (was missing)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'appointments'
          AND policyname = 'Doctor can delete own appointments by doctor_id'
    ) THEN
        CREATE POLICY "Doctor can delete own appointments by doctor_id"
            ON public.appointments FOR DELETE
            USING (auth.uid() = doctor_id);
    END IF;
END $$;
