-- =========================================================================
-- Immobilier MVP schema (catalogue + media + clients + visits)
-- =========================================================================

-- 1) Properties table
CREATE TABLE IF NOT EXISTS public.real_estate_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  title TEXT NOT NULL,
  price_dh NUMERIC,
  quartier TEXT,

  surface_m2 NUMERIC,
  bedrooms INT,
  floor INT,
  orientation TEXT,
  condition TEXT, -- neuf/ancien

  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,

  status TEXT NOT NULL DEFAULT 'Disponible'
    CHECK (status IN ('Disponible', 'Réservé', 'Vendu', 'Loué')),

  -- Atouts / options (stored flexibly)
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.real_estate_properties ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_properties' AND policyname='re_properties_select'
  ) THEN
    CREATE POLICY re_properties_select
      ON public.real_estate_properties FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_properties' AND policyname='re_properties_write'
  ) THEN
    CREATE POLICY re_properties_write
      ON public.real_estate_properties FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 2) Media table (links files to a property)
CREATE TABLE IF NOT EXISTS public.real_estate_property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.real_estate_properties(id) ON DELETE CASCADE NOT NULL,

  media_type TEXT NOT NULL CHECK (media_type IN ('photo', 'video')),
  file_path TEXT NOT NULL,
  public_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.real_estate_property_media ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_property_media' AND policyname='re_media_select'
  ) THEN
    CREATE POLICY re_media_select
      ON public.real_estate_property_media FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_property_media' AND policyname='re_media_write'
  ) THEN
    CREATE POLICY re_media_write
      ON public.real_estate_property_media FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 3) Clients table (buyers and sellers) - MVP
CREATE TABLE IF NOT EXISTS public.real_estate_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,

  role TEXT NOT NULL CHECK (role IN ('acquereur', 'vendeur')),

  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,

  -- For buyers: criteria; For sellers: ownership details.
  details JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.real_estate_clients ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_clients' AND policyname='re_clients_select'
  ) THEN
    CREATE POLICY re_clients_select
      ON public.real_estate_clients FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_clients' AND policyname='re_clients_write'
  ) THEN
    CREATE POLICY re_clients_write
      ON public.real_estate_clients FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4) Visits table (real estate scheduling)
CREATE TABLE IF NOT EXISTS public.real_estate_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.real_estate_properties(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.real_estate_clients(id) ON DELETE SET NULL,

  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,

  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'pending', 'cancelled')),

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.real_estate_visits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_visits' AND policyname='re_visits_select'
  ) THEN
    CREATE POLICY re_visits_select
      ON public.real_estate_visits FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='real_estate_visits' AND policyname='re_visits_write'
  ) THEN
    CREATE POLICY re_visits_write
      ON public.real_estate_visits FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 5) Storage bucket for property media
--    Using a "public" bucket simplifies client-side preview URLs.
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-media', 'property-media', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='property-media_public_read'
  ) THEN
    CREATE POLICY property-media_public_read
      ON storage.objects FOR SELECT
      USING (bucket_id = 'property-media');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects' AND policyname='property-media_authenticated_upload'
  ) THEN
    CREATE POLICY property-media_authenticated_upload
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'property-media' AND auth.role() = 'authenticated');
  END IF;
END $$;

