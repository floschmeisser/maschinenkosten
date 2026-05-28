-- MaschinenKosten initial Supabase schema.
-- This file prepares the real database shape while the app can still run in local placeholder mode.

create extension if not exists "pgcrypto";

-- Farms own machines and maintenance tasks.
create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Machines store financial, usage and operational data in snake_case.
create table if not exists public.machines (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  category text not null,
  manufacturer text not null default '',
  model text not null default '',
  year_of_manufacture integer not null,
  purchase_date date,
  purchase_price numeric(12, 2) not null default 0,
  new_price numeric(12, 2) not null default 0,
  current_value numeric(12, 2) not null default 0,
  residual_value numeric(12, 2) not null default 0,
  expected_useful_life_years integer not null default 0,
  annual_operating_hours numeric(10, 1) not null default 0,
  current_operating_hours numeric(10, 1) not null default 0,
  current_kilometers numeric(12, 1),
  working_width_meters numeric(6, 2),
  hectares_per_hour numeric(8, 2),
  insurance_per_year numeric(12, 2) default 0,
  tax_per_year numeric(12, 2) default 0,
  storage_per_year numeric(12, 2) default 0,
  other_fixed_costs_per_year numeric(12, 2) default 0,
  maintenance_costs_per_year numeric(12, 2) default 0,
  repair_costs_per_year numeric(12, 2) default 0,
  fuel_costs_per_hour numeric(10, 2) default 0,
  operator_costs_per_hour numeric(10, 2) default 0,
  other_variable_costs_per_hour numeric(10, 2) default 0,
  annual_kilometers numeric(12, 1),
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint machines_category_check check (
    category in ('tractor', 'loader', 'harvester', 'grassland', 'tillage', 'transport', 'other')
  ),
  constraint machines_status_check check (
    status in ('active', 'maintenance', 'inactive', 'sold')
  )
);

-- Maintenance tasks can be one-off or interval-based by days, hours or kilometers.
create table if not exists public.maintenance_tasks (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  machine_id uuid not null references public.machines(id) on delete cascade,
  title text not null,
  type text not null default 'service',
  status text not null default 'open',
  due_date date,
  due_operating_hours numeric(10, 1),
  due_kilometers numeric(12, 1),
  interval_type text not null default 'none',
  interval_days integer,
  interval_operating_hours numeric(10, 1),
  interval_kilometers numeric(12, 1),
  estimated_cost numeric(12, 2) not null default 0,
  actual_cost numeric(12, 2),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_tasks_type_check check (
    type in ('oil_change', 'service', 'lubrication', 'repair', 'wear_part', 'inspection', 'cleaning', 'other')
  ),
  constraint maintenance_tasks_status_check check (
    status in ('open', 'planned', 'in_progress', 'completed', 'cancelled')
  ),
  constraint maintenance_tasks_interval_type_check check (
    interval_type in ('none', 'days', 'operating_hours', 'kilometers')
  )
);

create index if not exists machines_farm_id_idx on public.machines(farm_id);
create index if not exists farms_owner_id_idx on public.farms(owner_id);
create index if not exists machines_status_idx on public.machines(status);
create index if not exists maintenance_tasks_farm_id_idx on public.maintenance_tasks(farm_id);
create index if not exists maintenance_tasks_machine_id_idx on public.maintenance_tasks(machine_id);
create index if not exists maintenance_tasks_status_idx on public.maintenance_tasks(status);
create index if not exists maintenance_tasks_due_date_idx on public.maintenance_tasks(due_date);

-- Keep updated_at current for simple updates.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists farms_set_updated_at on public.farms;
create trigger farms_set_updated_at
before update on public.farms
for each row execute function public.set_updated_at();

drop trigger if exists machines_set_updated_at on public.machines;
create trigger machines_set_updated_at
before update on public.machines
for each row execute function public.set_updated_at();

drop trigger if exists maintenance_tasks_set_updated_at on public.maintenance_tasks;
create trigger maintenance_tasks_set_updated_at
before update on public.maintenance_tasks
for each row execute function public.set_updated_at();

-- Row level security: authenticated users can access rows for farms they own.
alter table public.farms enable row level security;
alter table public.machines enable row level security;
alter table public.maintenance_tasks enable row level security;

create policy "Farm owners can manage farms"
on public.farms
for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Farm owners can manage machines"
on public.machines
for all
to authenticated
using (
  exists (
    select 1 from public.farms
    where farms.id = machines.farm_id
    and farms.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.farms
    where farms.id = machines.farm_id
    and farms.owner_id = auth.uid()
  )
);

create policy "Farm owners can manage maintenance tasks"
on public.maintenance_tasks
for all
to authenticated
using (
  exists (
    select 1 from public.farms
    where farms.id = maintenance_tasks.farm_id
    and farms.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.farms
    where farms.id = maintenance_tasks.farm_id
    and farms.owner_id = auth.uid()
  )
);
