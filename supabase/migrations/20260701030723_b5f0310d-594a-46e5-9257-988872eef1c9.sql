
-- Grant execute on has_role to avoid permission errors anywhere it might still be referenced
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.current_user_has_role(public.app_role) TO authenticated, anon;

-- customers
DROP POLICY IF EXISTS "Atendimento/gerencia create customers" ON public.customers;
DROP POLICY IF EXISTS "Atendimento/gerencia update customers" ON public.customers;
DROP POLICY IF EXISTS "Gerencia deletes customers" ON public.customers;
DROP POLICY IF EXISTS "Customers readable by authenticated" ON public.customers;
CREATE POLICY "Customers read"   ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Customers insert" ON public.customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Customers update" ON public.customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Customers delete" ON public.customers FOR DELETE TO authenticated USING (true);

-- vehicles
DROP POLICY IF EXISTS "Atendimento/gerencia create vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Atendimento/gerencia/lavajato update vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Gerencia deletes vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Vehicles readable by authenticated" ON public.vehicles;
CREATE POLICY "Vehicles read"   ON public.vehicles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vehicles insert" ON public.vehicles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Vehicles update" ON public.vehicles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Vehicles delete" ON public.vehicles FOR DELETE TO authenticated USING (true);

-- orders
DROP POLICY IF EXISTS "Atendimento/gerencia create orders" ON public.orders;
DROP POLICY IF EXISTS "Operacional updates orders" ON public.orders;
DROP POLICY IF EXISTS "Gerencia deletes orders" ON public.orders;
DROP POLICY IF EXISTS "Orders readable by authenticated" ON public.orders;
CREATE POLICY "Orders read"   ON public.orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Orders insert" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Orders update" ON public.orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Orders delete" ON public.orders FOR DELETE TO authenticated USING (true);

-- services
DROP POLICY IF EXISTS "Gerencia manages services" ON public.services;
DROP POLICY IF EXISTS "Services readable by authenticated" ON public.services;
CREATE POLICY "Services read"   ON public.services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Services write"  ON public.services FOR ALL   TO authenticated USING (true) WITH CHECK (true);

-- service_prices
DROP POLICY IF EXISTS "Gerencia manages prices" ON public.service_prices;
DROP POLICY IF EXISTS "Prices readable by authenticated" ON public.service_prices;
CREATE POLICY "Prices read"  ON public.service_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Prices write" ON public.service_prices FOR ALL   TO authenticated USING (true) WITH CHECK (true);

-- service_time_stats
DROP POLICY IF EXISTS "Operacional updates stats" ON public.service_time_stats;
DROP POLICY IF EXISTS "Operacional writes stats" ON public.service_time_stats;
DROP POLICY IF EXISTS "Stats readable by authenticated" ON public.service_time_stats;
CREATE POLICY "Stats read"   ON public.service_time_stats FOR SELECT TO authenticated USING (true);
CREATE POLICY "Stats insert" ON public.service_time_stats FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Stats update" ON public.service_time_stats FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- app_accounts
DROP POLICY IF EXISTS "Gerencia updates app_accounts username" ON public.app_accounts;
DROP POLICY IF EXISTS "App accounts readable by authenticated" ON public.app_accounts;
CREATE POLICY "Accounts read"   ON public.app_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Accounts update" ON public.app_accounts FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- user_roles
DROP POLICY IF EXISTS "Gerencia manages roles" ON public.user_roles;
DROP POLICY IF EXISTS "Roles readable by authenticated" ON public.user_roles;
CREATE POLICY "Roles read"  ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Roles write" ON public.user_roles FOR ALL   TO authenticated USING (true) WITH CHECK (true);
