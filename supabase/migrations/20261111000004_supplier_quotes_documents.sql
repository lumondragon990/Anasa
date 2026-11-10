-- ============================================================================
-- ANASA COMMAND CENTER — Migration 0004
--   1. Manual quotation numbers (at creation, or renumbering a draft), logged
--   2. 'ANA' reserved as a customer code (it is the document prefix)
--   3. Supplier quotations linked to customer quotations (cost-restricted)
--   4. Documents: private Storage bucket + metadata table + policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Manual quotation numbers
-- ---------------------------------------------------------------------------
alter table public.quotations drop constraint quotations_number_format;
alter table public.quotations
  add constraint quotations_number_format check (quote_number ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  add column is_manual_number boolean not null default false;

-- Manual numbers do not consume the automatic sequence, so allow sequence 0
-- for them and keep uniqueness only for automatic ones.
alter table public.quotations drop constraint quotations_sequence_unique;
alter table public.quotations drop constraint quotations_sequence_check;
alter table public.quotations add constraint quotations_sequence_check check (sequence >= 0);
create unique index quotations_sequence_unique on public.quotations (customer_id, year, sequence) where sequence > 0;

create table public.quotation_number_history (
  id            uuid primary key default gen_random_uuid(),
  quotation_id  uuid not null references public.quotations (id) on delete cascade,
  old_number    text,
  new_number    text not null,
  reason        text,
  changed_by    uuid references public.profiles (id) default auth.uid(),
  changed_at    timestamptz not null default now()
);
create index quotation_number_history_quote_idx on public.quotation_number_history (quotation_id);

-- The identity guard now permits a number change only from renumber_quotation().
create or replace function public.guard_quotation_identity()
returns trigger language plpgsql as $$
begin
  if new.customer_id <> old.customer_id
     or new.customer_code_at_issue <> old.customer_code_at_issue
     or new.year <> old.year
     or new.sequence <> old.sequence then
    raise exception 'Quotation customer and sequence cannot be changed once created';
  end if;
  if new.quote_number <> old.quote_number
     and coalesce(current_setting('anasa.allow_renumber', true), '') <> 'on' then
    raise exception 'Quotation numbers can only be changed with renumber_quotation()';
  end if;
  return new;
end $$;

create or replace function public.normalize_quote_number(p text)
returns text language sql immutable as $$
  select upper(regexp_replace(trim(coalesce(p, '')), '\s+', '-', 'g'))
$$;

-- Replace create_quotation with a version that accepts an optional manual
-- number and skips automatic numbers that a manual number already took.
drop function public.create_quotation(uuid, text, text, text, date, uuid);

create or replace function public.create_quotation(
  p_customer_id        uuid,
  p_title              text,
  p_customer_reference text default null,
  p_currency           text default null,
  p_valid_until        date default null,
  p_contact_id         uuid default null,
  p_manual_number      text default null,
  p_manual_reason      text default null
) returns public.quotations
language plpgsql security definer set search_path = public as $$
declare
  v_customer public.customers;
  v_year     int := public.business_year();
  v_seq      int := 0;
  v_number   text;
  v_manual   text := nullif(public.normalize_quote_number(p_manual_number), '');
  v_quote    public.quotations;
  v_rev_id   uuid;
begin
  if not public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]) then
    raise exception 'You do not have permission to create quotations' using errcode = 'insufficient_privilege';
  end if;
  if v_manual is not null and not public.has_role(array['super_admin','director','operations_manager']::public.app_role[]) then
    raise exception 'Only a Super Administrator, Director or Operations Manager can set a quotation number by hand'
      using errcode = 'insufficient_privilege';
  end if;
  if v_manual is not null and coalesce(trim(p_manual_reason), '') = '' then
    raise exception 'A reason is required when setting a quotation number by hand';
  end if;

  select * into v_customer from public.customers where id = p_customer_id for share;
  if v_customer.id is null then raise exception 'Customer not found'; end if;
  if v_customer.status = 'inactive' then raise exception 'Customer % is inactive', v_customer.customer_code; end if;

  if v_manual is not null then
    if v_manual !~ '^[A-Z0-9][A-Z0-9-]{2,39}$' then
      raise exception 'Quotation numbers use 3–40 letters, digits and dashes';
    end if;
    if exists (select 1 from public.quotations where quote_number = v_manual) then
      raise exception 'Quotation number % is already in use', v_manual using errcode = 'unique_violation';
    end if;
    v_number := v_manual;
  else
    loop
      v_seq := public.next_quotation_sequence(v_customer.id, v_year);
      v_number := format('ANA-%s-Q-%s-%s', v_customer.customer_code, v_year, lpad(v_seq::text, 4, '0'));
      exit when not exists (select 1 from public.quotations where quote_number = v_number);
    end loop;
  end if;

  insert into public.quotations (quote_number, customer_id, customer_code_at_issue, year, sequence,
                                 title, customer_reference, currency, valid_until, customer_contact_id,
                                 is_manual_number)
  values (v_number, v_customer.id, v_customer.customer_code, v_year, v_seq,
          trim(p_title), nullif(trim(p_customer_reference), ''),
          upper(coalesce(nullif(p_currency, ''), v_customer.currency)), p_valid_until, p_contact_id,
          v_manual is not null)
  returning * into v_quote;

  insert into public.quotation_revisions (quotation_id, revision_no, reason, payment_terms)
  values (v_quote.id, 0, 'Initial issue', v_customer.payment_terms)
  returning id into v_rev_id;

  update public.quotations set current_revision_id = v_rev_id where id = v_quote.id returning * into v_quote;

  insert into public.quotation_number_history (quotation_id, old_number, new_number, reason)
  values (v_quote.id, null, v_number, case when v_manual is not null then trim(p_manual_reason) else 'Assigned automatically' end);

  return v_quote;
end $$;

-- Renumber a quotation that has not been approved or sent yet.
create or replace function public.renumber_quotation(p_quotation_id uuid, p_new_number text, p_reason text)
returns public.quotations
language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotations;
  v_new   text := public.normalize_quote_number(p_new_number);
begin
  if not public.has_role(array['super_admin','director','operations_manager']::public.app_role[]) then
    raise exception 'Only a Super Administrator, Director or Operations Manager can change a quotation number'
      using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A reason is required to change a quotation number'; end if;
  if v_new !~ '^[A-Z0-9][A-Z0-9-]{2,39}$' then
    raise exception 'Quotation numbers use 3–40 letters, digits and dashes';
  end if;

  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if v_quote.id is null then raise exception 'Quotation not found'; end if;
  if v_quote.quote_number = v_new then return v_quote; end if;
  if v_quote.status not in ('draft','under_review')
     or exists (select 1 from public.quotation_revisions where quotation_id = v_quote.id and is_locked) then
    raise exception 'The number can only change before the first revision is approved. Once a quotation has been approved or sent, its number is permanent.';
  end if;
  if exists (select 1 from public.quotations where quote_number = v_new) then
    raise exception 'Quotation number % is already in use', v_new using errcode = 'unique_violation';
  end if;

  perform set_config('anasa.allow_renumber', 'on', true);
  update public.quotations set quote_number = v_new, is_manual_number = true
   where id = v_quote.id returning * into v_quote;
  perform set_config('anasa.allow_renumber', 'off', true);

  insert into public.quotation_number_history (quotation_id, old_number, new_number, reason)
  select v_quote.id, h.new_number, v_new, trim(p_reason)
    from public.quotation_number_history h
   where h.quotation_id = v_quote.id order by changed_at desc limit 1;
  if not found then
    insert into public.quotation_number_history (quotation_id, old_number, new_number, reason)
    values (v_quote.id, null, v_new, trim(p_reason));
  end if;
  return v_quote;
end $$;

-- ---------------------------------------------------------------------------
-- 2. 'ANA' is the document prefix, so it cannot be a customer code
-- ---------------------------------------------------------------------------
create or replace function public.customer_code_available(p_code text)
returns boolean
language sql stable security definer set search_path = public as $$
  select upper(trim(p_code)) ~ '^[A-Z0-9]{2,6}$'
     and upper(trim(p_code)) <> 'ANA'
     and not exists (select 1 from public.customer_code_registry where code = upper(trim(p_code)))
$$;

create or replace function public.customers_block_reserved_code()
returns trigger language plpgsql as $$
begin
  if new.customer_code = 'ANA' and (tg_op = 'INSERT' or old.customer_code <> 'ANA') then
    raise exception 'ANA is the ANASA document prefix and cannot be used as a customer code';
  end if;
  return new;
end $$;
create trigger customers_block_reserved_code before insert or update of customer_code on public.customers
  for each row execute function public.customers_block_reserved_code();

-- ---------------------------------------------------------------------------
-- 3. Supplier quotations
-- ---------------------------------------------------------------------------
create type public.supplier_quote_status as enum ('received','selected','not_selected','expired','withdrawn');

create table public.supplier_quotes (
  id                     uuid primary key default gen_random_uuid(),
  supplier_id            uuid not null references public.suppliers (id) on delete restrict,
  quotation_id           uuid references public.quotations (id) on delete restrict,  -- the ANASA customer quotation it prices
  supplier_quote_number  text not null check (length(trim(supplier_quote_number)) > 0),
  quote_date             date,
  valid_until            date,
  currency               char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  total_amount           numeric(18,2) check (total_amount >= 0),
  freight                numeric(18,2) not null default 0 check (freight >= 0),
  lead_time              text,
  delivery_terms         text,
  scope_summary          text,
  exclusions             text,
  status                 public.supplier_quote_status not null default 'received',
  notes                  text,
  created_by             uuid references public.profiles (id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint supplier_quote_number_unique_per_supplier unique (supplier_id, supplier_quote_number)
);
create index supplier_quotes_quotation_idx on public.supplier_quotes (quotation_id);
create index supplier_quotes_supplier_idx on public.supplier_quotes (supplier_id, created_at desc);
create trigger supplier_quotes_updated_at before update on public.supplier_quotes
  for each row execute function public.set_updated_at();
create trigger audit_supplier_quotes after insert or update or delete on public.supplier_quotes
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- 4. Documents
-- ---------------------------------------------------------------------------
create type public.document_category as enum (
  'customer_rfq','drawing','specification','datasheet','supplier_quote','customer_po',
  'quotation','certificate','report','correspondence','other'
);

create table public.documents (
  id                 uuid primary key default gen_random_uuid(),
  storage_bucket     text not null default 'documents',
  storage_path       text not null unique,
  file_name          text not null,
  content_type       text,
  size_bytes         bigint check (size_bytes >= 0),
  category           public.document_category not null default 'other',
  description        text,
  customer_id        uuid references public.customers (id) on delete restrict,
  supplier_id        uuid references public.suppliers (id) on delete restrict,
  quotation_id       uuid references public.quotations (id) on delete restrict,
  supplier_quote_id  uuid references public.supplier_quotes (id) on delete restrict,
  -- Cost-restricted documents (supplier pricing) are visible only to cost roles.
  cost_restricted    boolean not null default false,
  uploaded_by        uuid references public.profiles (id) default auth.uid(),
  uploaded_at        timestamptz not null default now(),
  constraint documents_linked check (num_nonnulls(customer_id, supplier_id, quotation_id, supplier_quote_id) > 0)
);
create index documents_quotation_idx on public.documents (quotation_id);
create index documents_supplier_quote_idx on public.documents (supplier_quote_id);
create trigger audit_documents after insert or update or delete on public.documents
  for each row execute function public.audit_row();

-- Anything attached to a supplier quote is cost-restricted, always.
create or replace function public.documents_force_restriction()
returns trigger language plpgsql as $$
begin
  if new.supplier_quote_id is not null or new.category = 'supplier_quote' then
    new.cost_restricted := true;
  end if;
  if new.cost_restricted and new.storage_path not like 'restricted/%' then
    raise exception 'Cost-restricted files must be stored under restricted/';
  end if;
  if not new.cost_restricted and new.storage_path not like 'general/%' then
    raise exception 'Files must be stored under general/';
  end if;
  return new;
end $$;
create trigger documents_force_restriction before insert or update on public.documents
  for each row execute function public.documents_force_restriction();

-- Private bucket, 50 MB per file.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

-- Storage policies: internal staff can read/upload general files; only cost
-- roles can read/upload restricted ones. Nobody can update (originals are
-- preserved); deletes are limited to Super Administrator and Director.
create policy anasa_documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and public.is_internal()
         and (name like 'general/%' or (name like 'restricted/%' and public.can_view_costs())));

create policy anasa_documents_upload on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and public.is_internal()
              and (name like 'general/%' or (name like 'restricted/%' and public.can_view_costs())));

create policy anasa_documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and public.has_role(array['super_admin','director']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- RLS and grants for the new tables
-- ---------------------------------------------------------------------------
alter table public.quotation_number_history enable row level security;
alter table public.supplier_quotes          enable row level security;
alter table public.documents                enable row level security;

revoke all on public.quotation_number_history, public.supplier_quotes, public.documents from anon, authenticated;

grant select on public.quotation_number_history to authenticated;
create policy quote_number_history_select on public.quotation_number_history
  for select to authenticated using (public.is_internal());

grant select, insert, update on public.supplier_quotes to authenticated;
create policy supplier_quotes_select on public.supplier_quotes
  for select to authenticated using (public.can_view_costs());
create policy supplier_quotes_insert on public.supplier_quotes
  for insert to authenticated
  with check (public.has_role(array['super_admin','director','operations_manager','procurement_manager','sales_rep']::public.app_role[]));
create policy supplier_quotes_update on public.supplier_quotes
  for update to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','procurement_manager','sales_rep']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','procurement_manager','sales_rep']::public.app_role[]));

grant select, insert, delete on public.documents to authenticated;
create policy documents_select on public.documents
  for select to authenticated
  using (public.is_internal() and (not cost_restricted or public.can_view_costs()));
create policy documents_insert on public.documents
  for insert to authenticated
  with check (public.is_internal() and (not cost_restricted or public.can_view_costs()) and uploaded_by = auth.uid());
create policy documents_delete on public.documents
  for delete to authenticated
  using (public.has_role(array['super_admin','director']::public.app_role[]));

grant execute on function public.create_quotation(uuid, text, text, text, date, uuid, text, text) to authenticated;
grant execute on function public.renumber_quotation(uuid, text, text) to authenticated;
grant execute on function public.normalize_quote_number(text) to authenticated;

-- New functions are executable by PUBLIC by default; close that.
revoke execute on function public.create_quotation(uuid, text, text, text, date, uuid, text, text) from public, anon;
revoke execute on function public.renumber_quotation(uuid, text, text) from public, anon;
revoke execute on function public.normalize_quote_number(text) from public, anon;
revoke execute on function public.customers_block_reserved_code() from public, anon;
revoke execute on function public.documents_force_restriction() from public, anon;
