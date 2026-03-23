-- ============================================================
-- Fix appointments table: add columns expected by the backend
-- that were missing from the original schema.
-- All statements use IF NOT EXISTS / DO blocks to be safe.
-- ============================================================

-- 1. Add doctor_id (maps to the clinic/user who owns the appointment)
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS doctor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Back-fill doctor_id from user_id for existing rows
UPDATE public.appointments
    SET doctor_id = user_id
    WHERE doctor_id IS NULL;

-- 2. Add patient_phone (original table had 'phone')
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS patient_phone TEXT;

-- Back-fill from existing 'phone' column
UPDATE public.appointments
    SET patient_phone = phone
    WHERE patient_phone IS NULL AND phone IS NOT NULL;

-- 3. Add start_time / end_time (original table had 'date_time')
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;

-- Back-fill start_time from date_time, end_time = date_time + 30 min
UPDATE public.appointments
    SET start_time = date_time,
        end_time   = date_time + INTERVAL '30 minutes'
    WHERE start_time IS NULL AND date_time IS NOT NULL;

-- 4. Add notes (original had service_type)
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.appointments
    SET notes = service_type
    WHERE notes IS NULL AND service_type IS NOT NULL;

-- 5. Add reminders_sent array (critical for the reminder service)
ALTER TABLE public.appointments
    ADD COLUMN IF NOT EXISTS reminders_sent INTEGER[] DEFAULT '{}';

-- 6. RLS: allow backend (service role) and the doctor themselves to read/write
--    by doctor_id (the existing policies use user_id which still works for frontend).
--    Add extra policies keyed on doctor_id for the webhook backend.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'appointments'
          AND policyname = 'Doctor can view own appointments by doctor_id'
    ) THEN
        CREATE POLICY "Doctor can view own appointments by doctor_id"
            ON public.appointments FOR SELECT
            USING (auth.uid() = doctor_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'appointments'
          AND policyname = 'Doctor can insert own appointments by doctor_id'
    ) THEN
        CREATE POLICY "Doctor can insert own appointments by doctor_id"
            ON public.appointments FOR INSERT
            WITH CHECK (auth.uid() = doctor_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'appointments'
          AND policyname = 'Doctor can update own appointments by doctor_id'
    ) THEN
        CREATE POLICY "Doctor can update own appointments by doctor_id"
            ON public.appointments FOR UPDATE
            USING (auth.uid() = doctor_id);
    END IF;
END $$;
