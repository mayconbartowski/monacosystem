CREATE OR REPLACE FUNCTION public.update_vehicle_without_ownership_change(
  _vehicle_id uuid,
  _expected_customer_id uuid,
  _plate text,
  _brand text,
  _model text,
  _color text,
  _year text,
  _category public.vehicle_category
)
RETURNS public.vehicles
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  current_vehicle public.vehicles;
  updated_vehicle public.vehicles;
BEGIN
  SELECT * INTO current_vehicle
  FROM public.vehicles
  WHERE id = _vehicle_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'vehicle_not_found';
  END IF;

  IF current_vehicle.customer_id <> _expected_customer_id THEN
    RAISE EXCEPTION 'vehicle_ownership_conflict';
  END IF;

  UPDATE public.vehicles
  SET plate = _plate,
      brand = _brand,
      model = _model,
      color = _color,
      year = _year,
      category = _category
  WHERE id = _vehicle_id
  RETURNING * INTO updated_vehicle;

  RETURN updated_vehicle;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_vehicle_without_ownership_change(uuid, uuid, text, text, text, text, text, public.vehicle_category) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_vehicle_without_ownership_change(uuid, uuid, text, text, text, text, text, public.vehicle_category) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_vehicle_without_ownership_change(uuid, uuid, text, text, text, text, text, public.vehicle_category) TO service_role;