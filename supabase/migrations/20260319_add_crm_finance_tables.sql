-- ============================================================
-- CRM AND FINANCE TABLES
-- ============================================================

-- Create patients table
CREATE TABLE IF NOT EXISTS public.patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS for patients
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own patients"
    ON public.patients
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Create treatments table
CREATE TABLE IF NOT EXISTS public.treatments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES public.patients(id) ON DELETE CASCADE,
    treatment_name TEXT NOT NULL,
    quantity TEXT,
    collected_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    product_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    net_profit DECIMAL(10,2) NOT NULL DEFAULT 0,
    date TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Calculate net_profit automatically
CREATE OR REPLACE FUNCTION public.calculate_net_profit()
RETURNS TRIGGER AS $$
BEGIN
    NEW.net_profit := NEW.collected_amount - NEW.product_cost;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_net_profit
    BEFORE INSERT OR UPDATE ON public.treatments
    FOR EACH ROW
    EXECUTE FUNCTION public.calculate_net_profit();

-- Enable RLS for treatments
ALTER TABLE public.treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own treatments"
    ON public.treatments
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
