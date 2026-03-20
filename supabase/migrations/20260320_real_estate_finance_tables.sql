-- =========================================================================
-- Immobilier finance + CRM support tables (commissions, rent payments, ads)
-- =========================================================================

-- 1) Sales / commissions
CREATE TABLE IF NOT EXISTS public.real_estate_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.real_estate_properties(id) ON DELETE CASCADE NOT NULL,

  sale_amount_dh NUMERIC NOT NULL,
  commission_rate NUMERIC NOT NULL DEFAULT 0.025, -- 2.5%
  commission_amount_dh NUMERIC NOT NULL DEFAULT 0,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.real_estate_sales ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.calculate_real_estate_commission()
RETURNS TRIGGER AS $$
BEGIN
  NEW.commission_amount_dh := COALESCE(NEW.sale_amount_dh, 0) * COALESCE(NEW.commission_rate, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calculate_real_estate_commission ON public.real_estate_sales;
CREATE TRIGGER trg_calculate_real_estate_commission
  BEFORE INSERT OR UPDATE ON public.real_estate_sales
  FOR EACH ROW EXECUTE FUNCTION public.calculate_real_estate_commission();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_sales' AND policyname='re_sales_select'
  ) THEN
    CREATE POLICY re_sales_select
      ON public.real_estate_sales FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_sales' AND policyname='re_sales_write'
  ) THEN
    CREATE POLICY re_sales_write
      ON public.real_estate_sales FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Rent payments
CREATE TABLE IF NOT EXISTS public.real_estate_rent_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.real_estate_properties(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.real_estate_clients(id) ON DELETE SET NULL,

  due_date DATE NOT NULL,
  amount_dh NUMERIC NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.real_estate_rent_payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_rent_payments' AND policyname='re_rent_select'
  ) THEN
    CREATE POLICY re_rent_select
      ON public.real_estate_rent_payments FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_rent_payments' AND policyname='re_rent_write'
  ) THEN
    CREATE POLICY re_rent_write
      ON public.real_estate_rent_payments FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Ads expenses per listing
CREATE TABLE IF NOT EXISTS public.real_estate_ad_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.real_estate_properties(id) ON DELETE CASCADE NOT NULL,

  platform TEXT NOT NULL, -- Facebook Ads / Avito / etc
  amount_dh NUMERIC NOT NULL,
  expense_date DATE NOT NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.real_estate_ad_expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_ad_expenses' AND policyname='re_ad_select'
  ) THEN
    CREATE POLICY re_ad_select
      ON public.real_estate_ad_expenses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_ad_expenses' AND policyname='re_ad_write'
  ) THEN
    CREATE POLICY re_ad_write
      ON public.real_estate_ad_expenses FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

