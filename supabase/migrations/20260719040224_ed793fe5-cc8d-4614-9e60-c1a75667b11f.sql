
-- 1) enums
DO $$ BEGIN
  CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.order_source AS ENUM ('customer', 'partner');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) partner_contracts
CREATE TABLE IF NOT EXISTS public.partner_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_phone text NOT NULL DEFAULT '',
  cnpj text NOT NULL,
  monthly_vehicle_limit integer NOT NULL CHECK (monthly_vehicle_limit > 0),
  contract_value numeric(12,2) NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_contracts_cnpj_active_idx
  ON public.partner_contracts (cnpj) WHERE active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_contracts TO authenticated;
GRANT ALL ON public.partner_contracts TO service_role;

ALTER TABLE public.partner_contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gerencia manages contracts" ON public.partner_contracts;
CREATE POLICY "gerencia manages contracts"
  ON public.partner_contracts FOR ALL
  TO authenticated
  USING (public.current_user_has_role('gerencia'))
  WITH CHECK (public.current_user_has_role('gerencia'));

DROP POLICY IF EXISTS "read active contracts" ON public.partner_contracts;
CREATE POLICY "read active contracts"
  ON public.partner_contracts FOR SELECT
  TO authenticated
  USING (active OR public.current_user_has_role('gerencia'));

DROP TRIGGER IF EXISTS partner_contracts_touch_updated_at ON public.partner_contracts;
CREATE TRIGGER partner_contracts_touch_updated_at
  BEFORE UPDATE ON public.partner_contracts
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) orders additions
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_status public.payment_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discount_percentage numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partner_contract_id uuid REFERENCES public.partner_contracts(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS order_source public.order_source NOT NULL DEFAULT 'customer';

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT discount_percentage_range CHECK (discount_percentage >= 0 AND discount_percentage <= 100);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4) backfill legacy
UPDATE public.orders
SET payment_status = 'paid',
    paid_at = COALESCE(completed_at, updated_at, created_at)
WHERE payment_method IS NOT NULL
  AND status IN ('completed', 'delivered')
  AND payment_status = 'pending';

UPDATE public.orders
SET payment_status = 'cancelled'
WHERE status = 'cancelled' AND payment_status <> 'cancelled';

-- 5) make customer_id/vehicle_id nullable for partner orders
ALTER TABLE public.orders ALTER COLUMN customer_id DROP NOT NULL;
ALTER TABLE public.orders ALTER COLUMN vehicle_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.orders
    ADD CONSTRAINT orders_source_integrity CHECK (
      (order_source = 'customer' AND customer_id IS NOT NULL AND vehicle_id IS NOT NULL AND partner_contract_id IS NULL)
      OR
      (order_source = 'partner' AND partner_contract_id IS NOT NULL)
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS orders_partner_month_idx
  ON public.orders (partner_contract_id, created_at)
  WHERE partner_contract_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS orders_paid_at_idx
  ON public.orders (paid_at)
  WHERE payment_status = 'paid';

-- 6) pay_order RPC (particular)
CREATE OR REPLACE FUNCTION public.pay_order(
  _order_id uuid,
  _payment_method public.payment_method,
  _discount_percentage numeric
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  o public.orders;
  base numeric;
  disc numeric;
  final_total numeric;
  qualifying boolean;
  new_count integer;
BEGIN
  IF _payment_method IS NULL THEN RAISE EXCEPTION 'payment_method_required'; END IF;
  IF _discount_percentage IS NULL OR _discount_percentage < 0 OR _discount_percentage > 100 THEN
    RAISE EXCEPTION 'invalid_discount';
  END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.status <> 'completed' THEN RAISE EXCEPTION 'order_not_completed'; END IF;
  IF o.payment_status <> 'pending' THEN RAISE EXCEPTION 'order_already_paid'; END IF;
  IF o.order_source = 'partner' THEN RAISE EXCEPTION 'partner_orders_not_billable'; END IF;

  base := o.subtotal - COALESCE(o.loyalty_discount, 0);
  disc := ROUND((base * _discount_percentage / 100)::numeric, 2);
  final_total := GREATEST(0, base - disc);

  UPDATE public.orders SET
    payment_method = _payment_method,
    discount_percentage = _discount_percentage,
    discount = disc,
    total = final_total,
    payment_status = 'paid',
    paid_at = now(),
    paid_by = auth.uid(),
    status = 'delivered'
  WHERE id = _order_id
  RETURNING * INTO o;

  -- loyalty consolidation (per plate) only after payment
  IF o.vehicle_id IS NOT NULL THEN
    SELECT COALESCE(loyalty_qualifying, true) INTO qualifying FROM public.services WHERE id = o.service_id;
    IF qualifying THEN
      IF o.loyalty_reward_used THEN
        UPDATE public.vehicles
          SET wash_count = 0, reward_available = false, last_reward_date = now()
          WHERE id = o.vehicle_id;
      ELSE
        UPDATE public.vehicles
          SET wash_count = LEAST(COALESCE(wash_count,0) + 1, 10),
              reward_available = (COALESCE(wash_count,0) + 1) >= 10
          WHERE id = o.vehicle_id;
      END IF;
    END IF;
  END IF;

  RETURN o;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pay_order(uuid, public.payment_method, numeric) TO authenticated;

-- 7) deliver_partner_order RPC
CREATE OR REPLACE FUNCTION public.deliver_partner_order(_order_id uuid)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE o public.orders;
BEGIN
  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.order_source <> 'partner' THEN RAISE EXCEPTION 'not_partner_order'; END IF;
  IF o.status <> 'completed' THEN RAISE EXCEPTION 'order_not_completed'; END IF;

  UPDATE public.orders SET
    status = 'delivered',
    payment_status = 'paid',
    paid_at = now(),
    paid_by = auth.uid(),
    total = 0,
    discount = 0
  WHERE id = _order_id
  RETURNING * INTO o;
  RETURN o;
END;
$$;
GRANT EXECUTE ON FUNCTION public.deliver_partner_order(uuid) TO authenticated;

-- 8) create_partner_order RPC (atomic monthly limit)
CREATE OR REPLACE FUNCTION public.create_partner_order(
  _partner_contract_id uuid,
  _plate text, _brand text, _model text, _color text, _year text,
  _category public.vehicle_category,
  _service_id uuid, _service_key text,
  _extras jsonb,
  _subtotal numeric,
  _notes text, _queue_position integer, _duration_minutes integer
) RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.partner_contracts;
  used integer;
  o public.orders;
  month_start timestamptz := date_trunc('month', now());
  month_end timestamptz := (date_trunc('month', now()) + interval '1 month');
BEGIN
  SELECT * INTO c FROM public.partner_contracts WHERE id = _partner_contract_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract_not_found'; END IF;
  IF NOT c.active THEN RAISE EXCEPTION 'contract_inactive'; END IF;

  SELECT COUNT(*) INTO used FROM public.orders
   WHERE partner_contract_id = _partner_contract_id
     AND status <> 'cancelled'
     AND created_at >= month_start AND created_at < month_end;

  IF used >= c.monthly_vehicle_limit THEN
    RAISE EXCEPTION 'contract_limit_reached';
  END IF;

  INSERT INTO public.orders(
    customer_id, customer_name, vehicle_id, vehicle_plate, vehicle_label,
    category, service_id, service_key, extras,
    subtotal, discount, loyalty_discount, loyalty_reward_used, total,
    payment_method, notes, queue_position, duration_minutes, status,
    created_by, order_source, partner_contract_id, payment_status
  ) VALUES (
    NULL, c.company_name, NULL, upper(_plate),
    trim(concat_ws(' ', NULLIF(_brand,''), NULLIF(_model,''), NULLIF(_color,''))),
    _category, _service_id, _service_key, COALESCE(_extras, '[]'::jsonb),
    _subtotal, 0, 0, false, _subtotal,
    NULL, COALESCE(_notes, ''), _queue_position, _duration_minutes, 'queued',
    auth.uid(), 'partner', _partner_contract_id, 'pending'
  ) RETURNING * INTO o;
  RETURN o;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_partner_order(uuid, text, text, text, text, text, public.vehicle_category, uuid, text, jsonb, numeric, text, integer, integer) TO authenticated;

-- 9) realtime
ALTER TABLE public.partner_contracts REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_contracts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN others THEN NULL; END $$;
