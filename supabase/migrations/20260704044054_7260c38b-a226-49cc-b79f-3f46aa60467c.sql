ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS customers_active_idx ON public.customers(active);