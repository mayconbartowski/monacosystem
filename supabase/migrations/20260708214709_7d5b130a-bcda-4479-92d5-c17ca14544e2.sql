
CREATE TABLE public.store_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  category text NOT NULL,
  expense_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  payment_method text,
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_expenses TO authenticated;
GRANT ALL ON public.store_expenses TO service_role;

ALTER TABLE public.store_expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Gerencia can view expenses"
  ON public.store_expenses FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'));

CREATE POLICY "Gerencia can insert expenses"
  ON public.store_expenses FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'gerencia'));

CREATE POLICY "Gerencia can update expenses"
  ON public.store_expenses FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'))
  WITH CHECK (public.has_role(auth.uid(), 'gerencia'));

CREATE POLICY "Gerencia can delete expenses"
  ON public.store_expenses FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'gerencia'));

CREATE TRIGGER store_expenses_touch_updated_at
  BEFORE UPDATE ON public.store_expenses
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX store_expenses_expense_date_idx ON public.store_expenses (expense_date DESC);
CREATE INDEX store_expenses_active_idx ON public.store_expenses (active);

ALTER PUBLICATION supabase_realtime ADD TABLE public.store_expenses;
