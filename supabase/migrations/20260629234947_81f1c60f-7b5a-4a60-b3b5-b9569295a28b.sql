
-- 1) Realtime publication for customers (vehicles/orders/services already added)
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.vehicles REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.services REPLICA IDENTITY FULL;
ALTER TABLE public.service_prices REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'customers'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.customers';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'service_prices'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.service_prices';
  END IF;
END$$;

-- 2) Allow gerencia to update username on app_accounts (never role/auth_user_id)
DROP POLICY IF EXISTS "Gerencia updates app_accounts username" ON public.app_accounts;
CREATE POLICY "Gerencia updates app_accounts username"
  ON public.app_accounts
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'gerencia'::app_role));

-- 3) Service time stats: secure recorder
GRANT SELECT ON public.service_time_stats TO authenticated;

CREATE OR REPLACE FUNCTION public.record_service_actual_minutes(_service_id uuid, _minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _minutes IS NULL OR _minutes <= 0 THEN RETURN; END IF;
  INSERT INTO public.service_time_stats (service_id, total_washes, sum_actual_minutes, updated_at)
  VALUES (_service_id, 1, _minutes, now())
  ON CONFLICT (service_id) DO UPDATE
  SET total_washes = public.service_time_stats.total_washes + 1,
      sum_actual_minutes = public.service_time_stats.sum_actual_minutes + EXCLUDED.sum_actual_minutes,
      updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.record_service_actual_minutes(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_service_actual_minutes(uuid, integer) TO authenticated;
