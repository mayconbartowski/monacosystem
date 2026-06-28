
-- =========================================================
-- ENUMS
-- =========================================================
create type public.app_role as enum ('atendimento', 'lavajato', 'gerencia');
create type public.vehicle_category as enum ('Hatch','Sedan','SUV','Picape','Luxo');
create type public.order_status as enum ('queued','in_progress','completed','cancelled');
create type public.payment_method as enum ('Crédito','Débito','Pix');

-- =========================================================
-- UTIL: updated_at
-- =========================================================
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================================
-- PROFILES
-- =========================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create policy "Profiles visible to authenticated"
  on public.profiles for select to authenticated using (true);
create policy "Users can update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- =========================================================
-- USER ROLES
-- =========================================================
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_user_has_role(_role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role(auth.uid(), _role)
$$;

create policy "Roles readable by authenticated"
  on public.user_roles for select to authenticated using (true);
create policy "Gerencia manages roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'gerencia'))
  with check (public.has_role(auth.uid(), 'gerencia'));

-- =========================================================
-- HANDLE_NEW_USER — profile + first user becomes gerencia
-- =========================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  user_count int;
  assigned_role public.app_role;
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));

  select count(*) into user_count from auth.users;
  if user_count <= 1 then
    assigned_role := 'gerencia';
  else
    assigned_role := 'atendimento';
  end if;

  insert into public.user_roles (user_id, role) values (new.id, assigned_role);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =========================================================
-- CUSTOMERS
-- =========================================================
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cpf text not null unique,
  whatsapp text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);
grant select, insert, update on public.customers to authenticated;
grant delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;

create policy "Customers readable by authenticated"
  on public.customers for select to authenticated using (true);
create policy "Atendimento/gerencia create customers"
  on public.customers for insert to authenticated
  with check (public.has_role(auth.uid(),'atendimento') or public.has_role(auth.uid(),'gerencia'));
create policy "Atendimento/gerencia update customers"
  on public.customers for update to authenticated
  using (public.has_role(auth.uid(),'atendimento') or public.has_role(auth.uid(),'gerencia'));
create policy "Gerencia deletes customers"
  on public.customers for delete to authenticated
  using (public.has_role(auth.uid(),'gerencia'));

create trigger customers_touch before update on public.customers
  for each row execute function public.touch_updated_at();

-- =========================================================
-- VEHICLES
-- =========================================================
create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  plate text not null unique,
  brand text not null default '',
  model text not null default '',
  color text not null default '',
  year text not null default '',
  category public.vehicle_category not null,
  wash_count int not null default 0,
  reward_available boolean not null default false,
  last_reward_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vehicles_customer_idx on public.vehicles(customer_id);
grant select, insert, update on public.vehicles to authenticated;
grant delete on public.vehicles to authenticated;
grant all on public.vehicles to service_role;
alter table public.vehicles enable row level security;

create policy "Vehicles readable by authenticated"
  on public.vehicles for select to authenticated using (true);
create policy "Atendimento/gerencia create vehicles"
  on public.vehicles for insert to authenticated
  with check (public.has_role(auth.uid(),'atendimento') or public.has_role(auth.uid(),'gerencia'));
create policy "Atendimento/gerencia/lavajato update vehicles"
  on public.vehicles for update to authenticated
  using (
    public.has_role(auth.uid(),'atendimento')
    or public.has_role(auth.uid(),'gerencia')
    or public.has_role(auth.uid(),'lavajato')
  );
create policy "Gerencia deletes vehicles"
  on public.vehicles for delete to authenticated
  using (public.has_role(auth.uid(),'gerencia'));

create trigger vehicles_touch before update on public.vehicles
  for each row execute function public.touch_updated_at();

-- =========================================================
-- SERVICES + PRICES
-- =========================================================
create table public.services (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  title text not null,
  description text not null default '',
  duration_minutes int not null default 60,
  position int not null default 0,
  active boolean not null default true,
  loyalty_qualifying boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.services to authenticated;
grant insert, update, delete on public.services to authenticated;
grant all on public.services to service_role;
alter table public.services enable row level security;

create policy "Services readable by authenticated"
  on public.services for select to authenticated using (true);
create policy "Gerencia manages services"
  on public.services for all to authenticated
  using (public.has_role(auth.uid(),'gerencia'))
  with check (public.has_role(auth.uid(),'gerencia'));

create trigger services_touch before update on public.services
  for each row execute function public.touch_updated_at();

create table public.service_prices (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  category public.vehicle_category not null,
  price numeric(10,2) not null default 0,
  unique (service_id, category)
);
grant select on public.service_prices to authenticated;
grant insert, update, delete on public.service_prices to authenticated;
grant all on public.service_prices to service_role;
alter table public.service_prices enable row level security;

create policy "Prices readable by authenticated"
  on public.service_prices for select to authenticated using (true);
create policy "Gerencia manages prices"
  on public.service_prices for all to authenticated
  using (public.has_role(auth.uid(),'gerencia'))
  with check (public.has_role(auth.uid(),'gerencia'));

-- =========================================================
-- ORDERS
-- =========================================================
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  service_id uuid not null references public.services(id) on delete restrict,
  customer_name text not null,
  vehicle_plate text not null,
  vehicle_label text not null,
  category public.vehicle_category not null,
  service_key text not null,
  extras jsonb not null default '[]'::jsonb,
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  loyalty_discount numeric(10,2) not null default 0,
  loyalty_reward_used boolean not null default false,
  total numeric(10,2) not null default 0,
  payment_method public.payment_method,
  notes text not null default '',
  queue_position int not null default 0,
  duration_minutes int not null default 60,
  status public.order_status not null default 'queued',
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  actual_minutes int,
  created_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
create index orders_status_idx on public.orders(status);
create index orders_vehicle_idx on public.orders(vehicle_id);
create index orders_customer_idx on public.orders(customer_id);
create index orders_created_idx on public.orders(created_at desc);

grant select, insert, update on public.orders to authenticated;
grant delete on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;

create policy "Orders readable by authenticated"
  on public.orders for select to authenticated using (true);
create policy "Atendimento/gerencia create orders"
  on public.orders for insert to authenticated
  with check (public.has_role(auth.uid(),'atendimento') or public.has_role(auth.uid(),'gerencia'));
create policy "Operacional updates orders"
  on public.orders for update to authenticated
  using (
    public.has_role(auth.uid(),'atendimento')
    or public.has_role(auth.uid(),'gerencia')
    or public.has_role(auth.uid(),'lavajato')
  );
create policy "Gerencia deletes orders"
  on public.orders for delete to authenticated
  using (public.has_role(auth.uid(),'gerencia'));

create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- =========================================================
-- SERVICE TIME STATS (média histórica por serviço)
-- =========================================================
create table public.service_time_stats (
  service_id uuid primary key references public.services(id) on delete cascade,
  total_washes int not null default 0,
  sum_actual_minutes int not null default 0,
  updated_at timestamptz not null default now()
);
grant select on public.service_time_stats to authenticated;
grant insert, update on public.service_time_stats to authenticated;
grant all on public.service_time_stats to service_role;
alter table public.service_time_stats enable row level security;

create policy "Stats readable by authenticated"
  on public.service_time_stats for select to authenticated using (true);
create policy "Operacional writes stats"
  on public.service_time_stats for insert to authenticated
  with check (
    public.has_role(auth.uid(),'lavajato')
    or public.has_role(auth.uid(),'gerencia')
    or public.has_role(auth.uid(),'atendimento')
  );
create policy "Operacional updates stats"
  on public.service_time_stats for update to authenticated
  using (
    public.has_role(auth.uid(),'lavajato')
    or public.has_role(auth.uid(),'gerencia')
    or public.has_role(auth.uid(),'atendimento')
  );

-- =========================================================
-- REALTIME
-- =========================================================
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.vehicles;
alter publication supabase_realtime add table public.services;
alter publication supabase_realtime add table public.service_prices;

-- =========================================================
-- SEED — services + default prices
-- =========================================================
with s as (
  insert into public.services (key, title, description, duration_minutes, position, active, loyalty_qualifying)
  values
    ('Essencial', 'Lavagem Essencial',  'Lavagem externa completa com produtos premium.', 60,  1, true, true),
    ('Premium',   'Lavagem Premium',    'Cuidado completo interno e externo para o dia a dia.', 120, 2, true, true),
    ('Golden',    'Lavagem Golden',     'Detalhamento avançado com proteção de superfícies.',   120, 3, true, true),
    ('Platinum',  'Lavagem Platinum Monaco', 'Experiência Monaco completa. Detalhamento profissional.', 240, 4, true, true)
  returning id, key
),
prices(key, category, price) as (
  values
    ('Essencial','Hatch'::public.vehicle_category, 150),
    ('Essencial','Sedan'::public.vehicle_category, 170),
    ('Essencial','SUV'::public.vehicle_category,   210),
    ('Essencial','Picape'::public.vehicle_category,320),
    ('Essencial','Luxo'::public.vehicle_category,  320),
    ('Premium','Hatch'::public.vehicle_category,   220),
    ('Premium','Sedan'::public.vehicle_category,   240),
    ('Premium','SUV'::public.vehicle_category,     300),
    ('Premium','Picape'::public.vehicle_category,  450),
    ('Premium','Luxo'::public.vehicle_category,    450),
    ('Golden','Hatch'::public.vehicle_category,    320),
    ('Golden','Sedan'::public.vehicle_category,    350),
    ('Golden','SUV'::public.vehicle_category,      430),
    ('Golden','Picape'::public.vehicle_category,   650),
    ('Golden','Luxo'::public.vehicle_category,     650),
    ('Platinum','Hatch'::public.vehicle_category,  450),
    ('Platinum','Sedan'::public.vehicle_category,  490),
    ('Platinum','SUV'::public.vehicle_category,    590),
    ('Platinum','Picape'::public.vehicle_category, 890),
    ('Platinum','Luxo'::public.vehicle_category,   890)
)
insert into public.service_prices (service_id, category, price)
select s.id, p.category, p.price
from prices p join s on s.key = p.key;
