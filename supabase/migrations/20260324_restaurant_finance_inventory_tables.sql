-- =========================================================================
-- Restaurant finance & inventory tables
-- =========================================================================

-- 1) Inventory / Stock tracking
CREATE TABLE IF NOT EXISTS public.restaurant_inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  item_name TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unité',
  unit_cost_dh NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 5,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_inventory ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_inventory' AND policyname='rst_inventory_select'
  ) THEN
    CREATE POLICY rst_inventory_select
      ON public.restaurant_inventory FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_inventory' AND policyname='rst_inventory_write'
  ) THEN
    CREATE POLICY rst_inventory_write
      ON public.restaurant_inventory FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Expenses tracking
CREATE TABLE IF NOT EXISTS public.restaurant_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  category TEXT NOT NULL
    CHECK (category IN ('ingredients', 'utilities', 'rent', 'equipment', 'marketing', 'other')),
  description TEXT,
  amount_dh NUMERIC NOT NULL,
  expense_date DATE NOT NULL,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_expenses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_expenses' AND policyname='rst_expenses_select'
  ) THEN
    CREATE POLICY rst_expenses_select
      ON public.restaurant_expenses FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_expenses' AND policyname='rst_expenses_write'
  ) THEN
    CREATE POLICY rst_expenses_write
      ON public.restaurant_expenses FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
