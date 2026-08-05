-- Preflight verificado: 0 duplicatas de cpf, whatsapp e placa normalizados.
-- Nenhum dado é apagado, unido ou reatribuído.

CREATE UNIQUE INDEX IF NOT EXISTS customers_cpf_normalized_uidx
  ON public.customers ((regexp_replace(cpf, '[^0-9]', '', 'g')))
  WHERE regexp_replace(cpf, '[^0-9]', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS customers_whatsapp_normalized_uidx
  ON public.customers ((regexp_replace(whatsapp, '[^0-9]', '', 'g')))
  WHERE regexp_replace(whatsapp, '[^0-9]', '', 'g') <> '';

CREATE UNIQUE INDEX IF NOT EXISTS vehicles_plate_normalized_uidx
  ON public.vehicles ((upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g'))))
  WHERE upper(regexp_replace(plate, '[^A-Za-z0-9]', '', 'g')) <> '';