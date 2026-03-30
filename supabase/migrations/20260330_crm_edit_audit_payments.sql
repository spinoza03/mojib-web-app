-- ============================================================
-- CRM: Audit trail for treatment edits + Payment installments
-- ============================================================

-- 1a. Treatment modifications (audit trail)
CREATE TABLE IF NOT EXISTS public.treatment_modifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    treatment_id UUID REFERENCES public.treatments(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    modified_by_name TEXT NOT NULL,
    modified_by_role TEXT NOT NULL CHECK (modified_by_role IN ('doctor', 'assistant')),
    previous_values JSONB NOT NULL,
    modification_date TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.treatment_modifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own treatment modifications"
    ON public.treatment_modifications
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1b. Patient payments / versements
CREATE TABLE IF NOT EXISTS public.patient_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_date TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.patient_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own patient payments"
    ON public.patient_payments
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 1c. Total agreed price on patients
ALTER TABLE public.patients
    ADD COLUMN IF NOT EXISTS total_agreed_price DECIMAL(10,2) DEFAULT 0;
