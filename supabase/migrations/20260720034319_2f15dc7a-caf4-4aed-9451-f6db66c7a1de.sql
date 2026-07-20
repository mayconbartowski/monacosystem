
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS service_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_fee_note text;

CREATE OR REPLACE FUNCTION public.pay_order(
  _order_id uuid,
  _payment_method payment_method,
  _discount_percentage numeric,
  _service_fee numeric DEFAULT 0,
  _service_fee_note text DEFAULT NULL
)
 RETURNS orders
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  o public.orders;
  base numeric;
  disc numeric;
  fee numeric;
  final_total numeric;
  qualifying boolean;
BEGIN
  IF _payment_method IS NULL THEN RAISE EXCEPTION 'payment_method_required'; END IF;
  IF _discount_percentage IS NULL OR _discount_percentage < 0 OR _discount_percentage > 100 THEN
    RAISE EXCEPTION 'invalid_discount';
  END IF;
  fee := COALESCE(_service_fee, 0);
  IF fee < 0 THEN RAISE EXCEPTION 'invalid_service_fee'; END IF;

  SELECT * INTO o FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'order_not_found'; END IF;
  IF o.status <> 'completed' THEN RAISE EXCEPTION 'order_not_completed'; END IF;
  IF o.payment_status <> 'pending' THEN RAISE EXCEPTION 'order_already_paid'; END IF;
  IF o.order_source = 'partner' THEN RAISE EXCEPTION 'partner_orders_not_billable'; END IF;

  base := o.subtotal - COALESCE(o.loyalty_discount, 0);
  disc := ROUND((base * _discount_percentage / 100)::numeric, 2);
  final_total := GREATEST(0, base - disc) + fee;

  UPDATE public.orders SET
    payment_method = _payment_method,
    discount_percentage = _discount_percentage,
    discount = disc,
    service_fee = fee,
    service_fee_note = NULLIF(trim(COALESCE(_service_fee_note, '')), ''),
    total = final_total,
    payment_status = 'paid',
    paid_at = now(),
    paid_by = auth.uid(),
    status = 'delivered'
  WHERE id = _order_id
  RETURNING * INTO o;

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
$function$;
