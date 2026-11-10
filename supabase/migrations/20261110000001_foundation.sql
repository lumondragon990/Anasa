-- ============================================================================
-- ANASA COMMAND CENTER — Migration 0001: Foundation
-- Profiles & roles, application settings, customers, suppliers, audit log.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------------
create type public.app_role as enum (
  'pending',              -- signed up, no access until an administrator assigns a role
  'super_admin',
  'director',
  'operations_manager',
  'procurement_manager',
  'sales_rep',
  'service_coordinator',
  'finance_manager',
  'employee',
  'customer_portal',      -- Phase 11
  'supplier_portal'       -- Phase 11
);

create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        public.app_role not null default 'pending',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. Role drives every permission check.';

-- ---------------------------------------------------------------------------
-- Shared trigger helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers (SECURITY DEFINER so RLS policies can call them without recursion)
-- ---------------------------------------------------------------------------
create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid() and is_active
$$;

create or replace function public.has_role(roles public.app_role[])
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() = any(roles), false)
$$;

create or replace function public.is_internal()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(public.current_app_role() not in ('pending','customer_portal','supplier_portal'), false)
$$;

-- Roles allowed to see supplier costs and internal margins.
create or replace function public.can_view_costs()
returns boolean
language sql stable security definer set search_path = public as $$
  select public.has_role(array['super_admin','director','operations_manager',
                               'procurement_manager','sales_rep','finance_manager']::public.app_role[])
$$;

-- ---------------------------------------------------------------------------
-- New auth user → profile. The very first user becomes super_admin
-- (bootstrap). Everyone after that starts as 'pending'.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role public.app_role := 'pending';
begin
  perform pg_advisory_xact_lock(hashtext('anasa_bootstrap_admin'));
  if not exists (select 1 from public.profiles where role = 'super_admin') then
    v_role := 'super_admin';
  end if;
  insert into public.profiles (id, email, full_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', null), v_role);
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Application settings
-- ---------------------------------------------------------------------------
create table public.application_settings (
  key         text primary key,
  value       jsonb not null,
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles (id)
);

insert into public.application_settings (key, value, description) values
  ('business_timezone', '"America/Chicago"', 'Timezone used to decide the year in document numbers.'),
  ('allow_self_approval', 'true', 'If false, the creator of a quotation revision cannot approve it.'),
  ('default_currency', '"USD"', 'Currency for new customers, suppliers and quotations.');

create or replace function public.get_setting(p_key text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select value from public.application_settings where key = p_key
$$;

-- Current year in the business timezone (used by every numbering function).
create or replace function public.business_year(p_at timestamptz default now())
returns int
language sql stable security definer set search_path = public as $$
  select extract(year from p_at at time zone coalesce(public.get_setting('business_timezone') #>> '{}', 'UTC'))::int
$$;

-- ---------------------------------------------------------------------------
-- Common enums
-- ---------------------------------------------------------------------------
create type public.party_status as enum ('prospect','active','on_hold','inactive');
create type public.location_kind as enum ('billing','shipping','job_site','office');
create type public.capability_kind as enum ('product','service','brand','certification');

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  customer_code       text not null,
  legal_name          text not null check (length(trim(legal_name)) > 0),
  display_name        text not null check (length(trim(display_name)) > 0),
  status              public.party_status not null default 'active',
  website             text,
  email               text,
  phone               text,
  tax_id              text,
  payment_terms       text,
  currency            char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  account_manager_id  uuid references public.profiles (id) on delete set null,
  billing_line1       text,
  billing_line2       text,
  billing_city        text,
  billing_state       text,
  billing_postal_code text,
  billing_country     text,
  notes               text,
  created_by          uuid references public.profiles (id) default auth.uid(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint customers_code_format check (customer_code ~ '^[A-Z0-9]{2,6}$'),
  constraint customers_code_unique unique (customer_code)
);

create index customers_search_idx on public.customers
  using gin (to_tsvector('simple', legal_name || ' ' || display_name || ' ' || customer_code));
create index customers_status_idx on public.customers (status);

create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();

-- Every customer code ever issued is reserved forever, so a retired code
-- can never be handed to a different company.
create table public.customer_code_registry (
  code         text primary key check (code ~ '^[A-Z0-9]{2,6}$'),
  customer_id  uuid not null references public.customers (id) on delete restrict,
  reserved_at  timestamptz not null default now()
);

create table public.customer_code_history (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  old_code     text,
  new_code     text not null,
  reason       text,
  changed_by   uuid references public.profiles (id) default auth.uid(),
  changed_at   timestamptz not null default now()
);

create or replace function public.customers_reserve_code()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  if tg_op = 'UPDATE' and new.customer_code = old.customer_code then
    return new;
  end if;

  select customer_id into v_owner from public.customer_code_registry where code = new.customer_code;
  if v_owner is not null and v_owner <> new.id then
    raise exception 'Customer code % has already been issued to another company and cannot be reused', new.customer_code
      using errcode = 'unique_violation';
  end if;

  if v_owner is null then
    insert into public.customer_code_registry (code, customer_id) values (new.customer_code, new.id);
  end if;

  insert into public.customer_code_history (customer_id, old_code, new_code, reason)
  values (new.id,
          case when tg_op = 'UPDATE' then old.customer_code end,
          new.customer_code,
          coalesce(current_setting('anasa.code_change_reason', true),
                   case when tg_op = 'INSERT' then 'Initial code' end));
  return new;
end $$;

create trigger customers_reserve_code
  after insert or update of customer_code on public.customers
  for each row execute function public.customers_reserve_code();

create table public.customer_contacts (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  first_name   text not null,
  last_name    text,
  title        text,
  email        text,
  phone        text,
  is_primary   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index customer_contacts_customer_idx on public.customer_contacts (customer_id);
create unique index customer_contacts_one_primary on public.customer_contacts (customer_id) where is_primary;
create trigger customer_contacts_updated_at before update on public.customer_contacts
  for each row execute function public.set_updated_at();

create table public.customer_locations (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  kind         public.location_kind not null,
  label        text not null,
  line1        text,
  line2        text,
  city         text,
  state        text,
  postal_code  text,
  country      text,
  site_notes   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index customer_locations_customer_idx on public.customer_locations (customer_id);
create trigger customer_locations_updated_at before update on public.customer_locations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id                 uuid primary key default gen_random_uuid(),
  supplier_code      text not null,
  legal_name         text not null check (length(trim(legal_name)) > 0),
  display_name       text not null check (length(trim(display_name)) > 0),
  status             public.party_status not null default 'active',
  website            text,
  email              text,
  phone              text,
  line1              text,
  line2              text,
  city               text,
  state              text,
  postal_code        text,
  country            text,
  service_territory  text,
  payment_terms      text,
  currency           char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  warranty_info      text,
  performance_notes  text,
  notes              text,
  created_by         uuid references public.profiles (id) default auth.uid(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint suppliers_code_format check (supplier_code ~ '^[A-Z0-9]{2,8}$'),
  constraint suppliers_code_unique unique (supplier_code)
);
create index suppliers_search_idx on public.suppliers
  using gin (to_tsvector('simple', legal_name || ' ' || display_name || ' ' || supplier_code));
create trigger suppliers_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();

create table public.supplier_contacts (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers (id) on delete cascade,
  first_name   text not null,
  last_name    text,
  title        text,
  email        text,
  phone        text,
  is_primary   boolean not null default false,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index supplier_contacts_supplier_idx on public.supplier_contacts (supplier_id);
create unique index supplier_contacts_one_primary on public.supplier_contacts (supplier_id) where is_primary;
create trigger supplier_contacts_updated_at before update on public.supplier_contacts
  for each row execute function public.set_updated_at();

create table public.supplier_capabilities (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid not null references public.suppliers (id) on delete cascade,
  kind         public.capability_kind not null,
  value        text not null check (length(trim(value)) > 0),
  notes        text,
  created_at   timestamptz not null default now(),
  unique (supplier_id, kind, value)
);
create index supplier_capabilities_value_idx on public.supplier_capabilities (lower(value));

-- ---------------------------------------------------------------------------
-- Audit log (append-only)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          bigint generated always as identity primary key,
  table_name  text not null,
  record_id   uuid,
  action      text not null check (action in ('INSERT','UPDATE','DELETE')),
  actor_id    uuid,
  at          timestamptz not null default now(),
  old_data    jsonb,
  new_data    jsonb
);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_at_idx on public.audit_logs (at desc);

create or replace function public.audit_row()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row   jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id    uuid;
begin
  begin
    v_id := (v_row ->> 'id')::uuid;
  exception when others then
    v_id := null;
  end;
  insert into public.audit_logs (table_name, record_id, action, actor_id, old_data, new_data)
  values (tg_table_name, v_id, tg_op, auth.uid(),
          case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end,
          case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end);
  return coalesce(new, old);
end $$;

create trigger audit_profiles   after insert or update or delete on public.profiles   for each row execute function public.audit_row();
create trigger audit_customers  after insert or update or delete on public.customers  for each row execute function public.audit_row();
create trigger audit_suppliers  after insert or update or delete on public.suppliers  for each row execute function public.audit_row();
create trigger application_settings_updated_at before update on public.application_settings for each row execute function public.set_updated_at();
create trigger audit_settings   after insert or update or delete on public.application_settings for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Administrative RPCs
-- ---------------------------------------------------------------------------

-- Change a customer's code. Only super_admin / director. Logged with reason.
-- Issued document numbers keep their original code (stored as text).
create or replace function public.change_customer_code(p_customer_id uuid, p_new_code text, p_reason text)
returns public.customers
language plpgsql security definer set search_path = public as $$
declare
  v_row public.customers;
  v_code text := upper(trim(p_new_code));
begin
  if not public.has_role(array['super_admin','director']::public.app_role[]) then
    raise exception 'Only a Super Administrator or Company Director can change a customer code'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'A reason is required to change a customer code';
  end if;
  perform set_config('anasa.code_change_reason', p_reason, true);
  update public.customers set customer_code = v_code where id = p_customer_id returning * into v_row;
  if v_row.id is null then
    raise exception 'Customer not found';
  end if;
  return v_row;
end $$;

-- Is a code free to use for a new company?
create or replace function public.customer_code_available(p_code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select upper(trim(p_code)) ~ '^[A-Z0-9]{2,6}$'
     and not exists (select 1 from public.customer_code_registry where code = upper(trim(p_code)))
$$;

-- Assign a role. Only super_admin. A super_admin cannot demote themself
-- (prevents locking the organization out).
create or replace function public.set_user_role(p_user_id uuid, p_role public.app_role, p_active boolean default true)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_row public.profiles;
begin
  if not public.has_role(array['super_admin']::public.app_role[]) then
    raise exception 'Only a Super Administrator can change user roles' using errcode = 'insufficient_privilege';
  end if;
  if p_user_id = auth.uid() and (p_role <> 'super_admin' or not p_active) then
    raise exception 'You cannot remove your own Super Administrator access';
  end if;
  update public.profiles set role = p_role, is_active = p_active where id = p_user_id returning * into v_row;
  return v_row;
end $$;
