-- =========================================================================
-- Restaurant MVP schema (menu, orders, customers)
-- =========================================================================

-- 1) Menu categories
CREATE TABLE IF NOT EXISTS public.restaurant_menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  name TEXT NOT NULL,
  display_order INT NOT NULL DEFAULT 0,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_menu_categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_menu_categories' AND policyname='rst_categories_select'
  ) THEN
    CREATE POLICY rst_categories_select
      ON public.restaurant_menu_categories FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_menu_categories' AND policyname='rst_categories_write'
  ) THEN
    CREATE POLICY rst_categories_write
      ON public.restaurant_menu_categories FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Menu items
CREATE TABLE IF NOT EXISTS public.restaurant_menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.restaurant_menu_categories(id) ON DELETE SET NULL,

  name TEXT NOT NULL,
  description TEXT,
  price_dh NUMERIC NOT NULL,
  photo_url TEXT,
  is_available BOOLEAN NOT NULL DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_menu_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_menu_items' AND policyname='rst_items_select'
  ) THEN
    CREATE POLICY rst_items_select
      ON public.restaurant_menu_items FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_menu_items' AND policyname='rst_items_write'
  ) THEN
    CREATE POLICY rst_items_write
      ON public.restaurant_menu_items FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Customers
CREATE TABLE IF NOT EXISTS public.restaurant_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,

  total_orders INT NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  last_order_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_customers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_customers' AND policyname='rst_customers_select'
  ) THEN
    CREATE POLICY rst_customers_select
      ON public.restaurant_customers FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_customers' AND policyname='rst_customers_write'
  ) THEN
    CREATE POLICY rst_customers_write
      ON public.restaurant_customers FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4) Orders
CREATE TABLE IF NOT EXISTS public.restaurant_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.restaurant_customers(id) ON DELETE SET NULL,

  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  delivery_address TEXT,

  order_type TEXT NOT NULL DEFAULT 'delivery'
    CHECK (order_type IN ('delivery', 'pickup', 'dine_in')),

  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'preparing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled')),

  total_dh NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,

  reminders_sent JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_orders' AND policyname='rst_orders_select'
  ) THEN
    CREATE POLICY rst_orders_select
      ON public.restaurant_orders FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_orders' AND policyname='rst_orders_write'
  ) THEN
    CREATE POLICY rst_orders_write
      ON public.restaurant_orders FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5) Order items (line items per order)
CREATE TABLE IF NOT EXISTS public.restaurant_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.restaurant_orders(id) ON DELETE CASCADE NOT NULL,
  menu_item_id UUID REFERENCES public.restaurant_menu_items(id) ON DELETE SET NULL,

  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price_dh NUMERIC NOT NULL,
  customizations TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_order_items' AND policyname='rst_order_items_select'
  ) THEN
    CREATE POLICY rst_order_items_select
      ON public.restaurant_order_items FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_order_items' AND policyname='rst_order_items_write'
  ) THEN
    CREATE POLICY rst_order_items_write
      ON public.restaurant_order_items FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 6) Storage bucket for menu photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('restaurant-media', 'restaurant-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='restaurant-media_public_read'
  ) THEN
    CREATE POLICY "restaurant-media_public_read"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'restaurant-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='restaurant-media_authenticated_upload'
  ) THEN
    CREATE POLICY "restaurant-media_authenticated_upload"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'restaurant-media' AND auth.role() = 'authenticated');
  END IF;
END $$;
