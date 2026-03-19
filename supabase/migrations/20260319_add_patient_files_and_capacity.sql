-- 1. Add capacity and interval settings to bot_configs
ALTER TABLE public.bot_configs 
ADD COLUMN IF NOT EXISTS slot_capacity INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS slot_interval_minutes INTEGER DEFAULT 30;

-- 2. Create the patient_files table for the CRM
CREATE TABLE IF NOT EXISTS public.patient_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.patient_files ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies for patient_files
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'patient_files' AND policyname = 'Users can view their own patient files'
    ) THEN
        CREATE POLICY "Users can view their own patient files" 
        ON public.patient_files FOR SELECT 
        USING (auth.uid() = user_id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'patient_files' AND policyname = 'Users can insert their own patient files'
    ) THEN
        CREATE POLICY "Users can insert their own patient files" 
        ON public.patient_files FOR INSERT 
        WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'patient_files' AND policyname = 'Users can delete their own patient files'
    ) THEN
        CREATE POLICY "Users can delete their own patient files" 
        ON public.patient_files FOR DELETE 
        USING (auth.uid() = user_id);
    END IF;
END $$;

-- 4. Supabase Storage Bucket for patient-files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('patient-files', 'patient-files', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
    -- Allow public read access (since URLs will be public)
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Public Access to patient-files'
    ) THEN
        CREATE POLICY "Public Access to patient-files" 
        ON storage.objects FOR SELECT 
        USING ( bucket_id = 'patient-files' );
    END IF;

    -- Allow authenticated users to upload files
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can upload patient-files'
    ) THEN
        CREATE POLICY "Authenticated users can upload patient-files" 
        ON storage.objects FOR INSERT 
        WITH CHECK ( bucket_id = 'patient-files' AND auth.role() = 'authenticated' );
    END IF;
	
	IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage' AND policyname = 'Authenticated users can delete patient-files'
    ) THEN
        CREATE POLICY "Authenticated users can delete patient-files" 
        ON storage.objects FOR DELETE 
        USING ( bucket_id = 'patient-files' AND auth.role() = 'authenticated' );
    END IF;
END $$;

-- 5. Postgres Trigger to prevent double booking beyond capacity
CREATE OR REPLACE FUNCTION public.check_appointment_capacity()
RETURNS TRIGGER AS $$
DECLARE
    doctor_capacity INTEGER;
    overlapping_count INTEGER;
BEGIN
    -- 1. Fetch the doctor's slot capacity from bot_configs (defaults to 1 if not found)
    SELECT COALESCE(slot_capacity, 1) INTO doctor_capacity
    FROM public.bot_configs
    WHERE user_id = NEW.doctor_id;

    -- If no config exists, default to 1
    IF doctor_capacity IS NULL THEN
        doctor_capacity := 1;
    END IF;

    -- 2. Count overlapping appointments
    -- An appointment overlaps if it starts before the NEW one ends AND ends after the NEW one starts
    SELECT COUNT(*) INTO overlapping_count
    FROM public.appointments
    WHERE doctor_id = NEW.doctor_id
      AND status != 'cancelled'
      AND (id != NEW.id OR NEW.id IS NULL) -- Exclude self if updating
      AND (
          (start_time < NEW.end_time) AND (end_time > NEW.start_time)
      );

    -- 3. Check capacity constraint
    IF overlapping_count >= doctor_capacity THEN
        RAISE EXCEPTION 'Capacité du créneau atteinte (Maximum %)', doctor_capacity;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS enforce_appointment_capacity ON public.appointments;

-- Create Trigger
CREATE TRIGGER enforce_appointment_capacity
BEFORE INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.check_appointment_capacity();
