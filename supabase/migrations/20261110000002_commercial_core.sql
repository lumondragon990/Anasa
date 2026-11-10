-- ============================================================================
-- ANASA COMMAND CENTER — Migration 0002: Commercial core
--
-- Defines, from day one, the permanent relationship:
--   customer → quotation (ANA-ABC-Q-YYYY-NNNN) → revisions (Rev 00, 01, …)
--            → accepted revision → customer PO → sales order (ANA-ABC-P-YYYY-NNNN)
--
-- Numbering rules (see docs/DECISIONS.md):
--   * Quote numbers are assigned when the draft is created. A cancelled
--     quote keeps its number; numbers are never reused, so gaps can exist.
--   * Quote and order sequences are independent, per customer and per year.
--   * Counters are keyed on customer UUID, not on the readable code, so a
--     code change continues the same sequence.
--   * The full number is stored as text at creation and never recomputed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Counters (written only by SECURITY DEFINER functions)
-- ---------------------------------------------------------------------------
create table public.quotation_counters (
  customer_id  uuid not null references public.customers (id) on delete restrict,
  year         int  not null check (year between 2000 and 2999),
  last_value   int  not null check (last_value >= 0),
  primary key (customer_id, year)
);

create table public.sales_order_counters (
  customer_id  uuid not null references public.customers (id) on delete restrict,
  year         int  not null check (year between 2000 and 2999),
  last_value   int  not null check (last_value >= 0),
  primary key (customer_id, year)
);

-- Global counters for REQ, SRFQ, SPO, SVC (used from Phase 3 onwards).
create table public.document_counters (
  doc_type     text not null check (doc_type in ('REQ','SRFQ','SPO','SVC')),
  year         int  not null check (year between 2000 and 2999),
  last_value   int  not null check (last_value >= 0),
  primary key (doc_type, year)
);

-- Atomic increment: INSERT … ON CONFLICT takes a row lock, so concurrent
-- callers serialize on the same (customer, year) row and each gets a
-- distinct value. A rolled-back transaction rolls back its increment too.
create or replace function public.next_quotation_sequence(p_customer_id uuid, p_year int)
returns int language sql security definer set search_path = public as $$
  insert into public.quotation_counters as c (customer_id, year, last_value)
  values (p_customer_id, p_year, 1)
  on conflict (customer_id, year) do update set last_value = c.last_value + 1
  returning last_value
$$;

create or replace function public.next_sales_order_sequence(p_customer_id uuid, p_year int)
returns int language sql security definer set search_path = public as $$
  insert into public.sales_order_counters as c (customer_id, year, last_value)
  values (p_customer_id, p_year, 1)
  on conflict (customer_id, year) do update set last_value = c.last_value + 1
  returning last_value
$$;

create or replace function public.next_document_number(p_doc_type text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_year int := public.business_year();
  v_seq  int;
begin
  insert into public.document_counters as c (doc_type, year, last_value)
  values (p_doc_type, v_year, 1)
  on conflict (doc_type, year) do update set last_value = c.last_value + 1
  returning last_value into v_seq;
  return format('ANA-%s-%s-%s', p_doc_type, v_year, lpad(v_seq::text, 5, '0'));
end $$;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.quotation_status as enum (
  'draft','under_review','approved','sent','customer_reviewing',
  'accepted','converted','rejected','expired','cancelled'
);
create type public.revision_status as enum ('draft','under_review','approved','superseded','rejected');
create type public.line_type as enum ('product','service','other');
create type public.sales_order_status as enum (
  'po_mismatch_review','open','in_progress','fulfilled','invoiced','closed','cancelled'
);
create type public.order_type as enum ('product','service','mixed');

-- ---------------------------------------------------------------------------
-- Quotations
-- ---------------------------------------------------------------------------
create table public.quotations (
  id                     uuid primary key default gen_random_uuid(),
  quote_number           text not null,
  customer_id            uuid not null references public.customers (id) on delete restrict,
  customer_code_at_issue text not null,
  year                   int  not null,
  sequence               int  not null check (sequence > 0),
  customer_request_id    uuid,          -- FK added in Phase 3 (customer_requests)
  customer_contact_id    uuid references public.customer_contacts (id) on delete set null,
  title                  text not null check (length(trim(title)) > 0),
  customer_reference     text,
  currency               char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  valid_until            date,
  status                 public.quotation_status not null default 'draft',
  current_revision_id    uuid,
  accepted_revision_id   uuid,
  owner_id               uuid references public.profiles (id) default auth.uid(),
  created_by             uuid references public.profiles (id) default auth.uid(),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint quotations_number_unique unique (quote_number),
  constraint quotations_sequence_unique unique (customer_id, year, sequence),
  constraint quotations_number_format check (quote_number ~ '^ANA-[A-Z0-9]{2,6}-Q-[0-9]{4}-[0-9]{4,}$')
);
create index quotations_customer_idx on public.quotations (customer_id, created_at desc);
create index quotations_status_idx on public.quotations (status);
create index quotations_number_search_idx on public.quotations (quote_number text_pattern_ops);
create trigger quotations_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();

create table public.quotation_revisions (
  id              uuid primary key default gen_random_uuid(),
  quotation_id    uuid not null references public.quotations (id) on delete restrict,
  revision_no     int  not null check (revision_no >= 0),
  status          public.revision_status not null default 'draft',
  reason          text,
  scope_summary   text,
  delivery_terms  text,
  payment_terms   text,
  commercial_terms text,
  exclusions      text,
  is_locked       boolean not null default false,
  snapshot        jsonb,                -- frozen copy at approval (immutable)
  subtotal        numeric(18,2) not null default 0,
  created_by      uuid references public.profiles (id) default auth.uid(),
  created_at      timestamptz not null default now(),
  approved_by     uuid references public.profiles (id),
  approved_at     timestamptz,
  approval_notes  text,
  unique (quotation_id, revision_no)
);

alter table public.quotations
  add constraint quotations_current_revision_fk  foreign key (current_revision_id)  references public.quotation_revisions (id) deferrable initially deferred,
  add constraint quotations_accepted_revision_fk foreign key (accepted_revision_id) references public.quotation_revisions (id) deferrable initially deferred;

create table public.quotation_line_items (
  id            uuid primary key default gen_random_uuid(),
  revision_id   uuid not null references public.quotation_revisions (id) on delete restrict,
  line_no       int  not null check (line_no > 0),
  line_type     public.line_type not null default 'product',
  description   text not null check (length(trim(description)) > 0),
  manufacturer  text,
  part_number   text,
  model         text,
  quantity      numeric(18,4) not null check (quantity > 0),
  unit          text not null default 'EA',
  unit_price    numeric(18,4) not null check (unit_price >= 0),   -- customer-facing selling price
  discount_pct  numeric(7,4) not null default 0 check (discount_pct >= 0 and discount_pct < 100),
  delivery_note text,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (revision_id, line_no)
);
create index quotation_line_items_revision_idx on public.quotation_line_items (revision_id);

-- Internal cost build-up lives in its own table so RLS can hide it from
-- roles that must never see supplier costs or margins.
create table public.quotation_line_costs (
  line_item_id     uuid primary key references public.quotation_line_items (id) on delete restrict,
  unit_cost        numeric(18,4) not null default 0 check (unit_cost >= 0),
  freight          numeric(18,4) not null default 0 check (freight >= 0),
  duties           numeric(18,4) not null default 0 check (duties >= 0),
  other_direct     numeric(18,4) not null default 0 check (other_direct >= 0),
  pricing_method   text check (pricing_method in ('markup','target_margin','fixed_profit','manual')),
  pricing_value    numeric(18,4),
  supplier_quote_line_id uuid,        -- FK added in Phase 4
  notes            text
);

-- Locked revisions (and their lines/costs) are immutable.
create or replace function public.guard_locked_revision()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.is_locked then raise exception 'Revision is locked and cannot be deleted'; end if;
    return old;
  end if;
  if old.is_locked then
    -- The only change allowed on a locked revision: approved → superseded, nothing else.
    if old.status = 'approved' and new.status = 'superseded'
       and (to_jsonb(new) - 'status') = (to_jsonb(old) - 'status') then
      return new;
    end if;
    raise exception 'Revision % of this quotation is approved and locked. Create a new revision instead.', old.revision_no;
  end if;
  return new;
end $$;
create trigger quotation_revisions_guard before update or delete on public.quotation_revisions
  for each row execute function public.guard_locked_revision();

create or replace function public.guard_locked_line()
returns trigger language plpgsql as $$
declare
  v_rev uuid;
  v_locked boolean;
begin
  if tg_table_name = 'quotation_line_items' then
    v_rev := case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
  else
    select revision_id into v_rev from public.quotation_line_items
     where id = case when tg_op = 'DELETE' then old.line_item_id else new.line_item_id end;
  end if;
  select is_locked into v_locked from public.quotation_revisions where id = v_rev;
  if coalesce(v_locked, false) then
    raise exception 'Lines of an approved revision cannot be changed. Create a new revision instead.';
  end if;
  return coalesce(new, old);
end $$;
create trigger quotation_line_items_guard before insert or update or delete on public.quotation_line_items
  for each row execute function public.guard_locked_line();
create trigger quotation_line_costs_guard before insert or update or delete on public.quotation_line_costs
  for each row execute function public.guard_locked_line();

-- Identity fields of a quotation can never change after creation.
create or replace function public.guard_quotation_identity()
returns trigger language plpgsql as $$
begin
  if new.quote_number <> old.quote_number
     or new.customer_id <> old.customer_id
     or new.customer_code_at_issue <> old.customer_code_at_issue
     or new.year <> old.year
     or new.sequence <> old.sequence then
    raise exception 'Quotation number and customer cannot be changed once issued';
  end if;
  return new;
end $$;
create trigger quotations_identity_guard before update on public.quotations
  for each row execute function public.guard_quotation_identity();

-- Keep revision subtotal in sync with its lines (while editable).
create or replace function public.recalc_revision_subtotal()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rev uuid := case when tg_op = 'DELETE' then old.revision_id else new.revision_id end;
begin
  update public.quotation_revisions r
     set subtotal = coalesce((
       select round(sum(quantity * unit_price * (1 - discount_pct / 100)), 2)
         from public.quotation_line_items where revision_id = v_rev), 0)
   where r.id = v_rev and not r.is_locked;
  return null;
end $$;
create trigger quotation_line_items_subtotal after insert or update or delete on public.quotation_line_items
  for each row execute function public.recalc_revision_subtotal();

-- ---------------------------------------------------------------------------
-- Customer purchase orders (document A — issued by the customer)
-- ---------------------------------------------------------------------------
create table public.customer_purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null references public.customers (id) on delete restrict,
  po_number     text not null check (length(trim(po_number)) > 0),  -- exactly as issued by the customer
  po_date       date,
  received_at   timestamptz not null default now(),
  currency      char(3) not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  total_amount  numeric(18,2),
  quotation_id  uuid references public.quotations (id) on delete restrict,
  notes         text,
  document_id   uuid,                 -- FK to documents in Phase 3
  created_by    uuid references public.profiles (id) default auth.uid(),
  created_at    timestamptz not null default now(),
  constraint customer_po_unique_per_customer unique (customer_id, po_number)
);

-- ---------------------------------------------------------------------------
-- Sales orders (document B — ANASA internal purchase reference)
-- ---------------------------------------------------------------------------
create table public.sales_orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           text not null,
  customer_id            uuid not null references public.customers (id) on delete restrict,
  customer_code_at_issue text not null,
  year                   int  not null,
  sequence               int  not null check (sequence > 0),
  source_quotation_id    uuid not null references public.quotations (id) on delete restrict,
  source_revision_id     uuid not null references public.quotation_revisions (id) on delete restrict,
  customer_po_id         uuid not null references public.customer_purchase_orders (id) on delete restrict,
  order_type             public.order_type not null,
  status                 public.sales_order_status not null default 'open',
  currency               char(3) not null,
  total_amount           numeric(18,2) not null,
  snapshot               jsonb not null,   -- exact accepted revision at conversion
  idempotency_key        text,
  converted_by           uuid references public.profiles (id) default auth.uid(),
  converted_at           timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint sales_orders_number_unique unique (order_number),
  constraint sales_orders_sequence_unique unique (customer_id, year, sequence),
  -- Initial implementation: one primary sales order per quotation.
  -- This constraint also makes conversion safe against double-clicks/retries.
  constraint sales_orders_one_per_quotation unique (source_quotation_id),
  constraint sales_orders_idempotency_unique unique (idempotency_key),
  constraint sales_orders_number_format check (order_number ~ '^ANA-[A-Z0-9]{2,6}-P-[0-9]{4}-[0-9]{4,}$')
);
create index sales_orders_customer_idx on public.sales_orders (customer_id, converted_at desc);
create trigger sales_orders_updated_at before update on public.sales_orders
  for each row execute function public.set_updated_at();

create table public.sales_order_lines (
  id                     uuid primary key default gen_random_uuid(),
  sales_order_id         uuid not null references public.sales_orders (id) on delete restrict,
  source_quote_line_id   uuid not null references public.quotation_line_items (id) on delete restrict,
  line_no                int  not null,
  line_type              public.line_type not null,
  description            text not null,
  manufacturer           text,
  part_number            text,
  model                  text,
  quantity               numeric(18,4) not null check (quantity > 0),
  unit                   text not null,
  unit_price             numeric(18,4) not null,
  discount_pct           numeric(7,4) not null default 0,
  unique (sales_order_id, line_no)
);

-- Audit commercial tables
create trigger audit_quotations           after insert or update or delete on public.quotations           for each row execute function public.audit_row();
create trigger audit_quotation_revisions  after insert or update or delete on public.quotation_revisions  for each row execute function public.audit_row();
create trigger audit_quotation_lines      after insert or update or delete on public.quotation_line_items for each row execute function public.audit_row();
create trigger audit_customer_pos         after insert or update or delete on public.customer_purchase_orders for each row execute function public.audit_row();
create trigger audit_sales_orders         after insert or update or delete on public.sales_orders         for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- RPC: create a quotation (assigns the number atomically, creates Rev 00)
-- ---------------------------------------------------------------------------
create or replace function public.create_quotation(
  p_customer_id        uuid,
  p_title              text,
  p_customer_reference text default null,
  p_currency           text default null,
  p_valid_until        date default null,
  p_contact_id         uuid default null
) returns public.quotations
language plpgsql security definer set search_path = public as $$
declare
  v_customer public.customers;
  v_year     int := public.business_year();
  v_seq      int;
  v_quote    public.quotations;
  v_rev_id   uuid;
begin
  if not public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]) then
    raise exception 'You do not have permission to create quotations' using errcode = 'insufficient_privilege';
  end if;

  -- Lock the customer row so a concurrent code change cannot interleave.
  select * into v_customer from public.customers where id = p_customer_id for share;
  if v_customer.id is null then raise exception 'Customer not found'; end if;
  if v_customer.status = 'inactive' then raise exception 'Customer % is inactive', v_customer.customer_code; end if;

  v_seq := public.next_quotation_sequence(v_customer.id, v_year);

  insert into public.quotations (quote_number, customer_id, customer_code_at_issue, year, sequence,
                                 title, customer_reference, currency, valid_until, customer_contact_id)
  values (format('ANA-%s-Q-%s-%s', v_customer.customer_code, v_year, lpad(v_seq::text, 4, '0')),
          v_customer.id, v_customer.customer_code, v_year, v_seq,
          trim(p_title), nullif(trim(p_customer_reference), ''),
          upper(coalesce(nullif(p_currency, ''), v_customer.currency)), p_valid_until, p_contact_id)
  returning * into v_quote;

  insert into public.quotation_revisions (quotation_id, revision_no, reason, payment_terms)
  values (v_quote.id, 0, 'Initial issue', v_customer.payment_terms)
  returning id into v_rev_id;

  update public.quotations set current_revision_id = v_rev_id where id = v_quote.id returning * into v_quote;
  return v_quote;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: approve the current revision (freezes an immutable snapshot)
-- ---------------------------------------------------------------------------
create or replace function public.approve_quotation_revision(p_revision_id uuid, p_notes text default null)
returns public.quotation_revisions
language plpgsql security definer set search_path = public as $$
declare
  v_rev   public.quotation_revisions;
  v_quote public.quotations;
  v_snap  jsonb;
begin
  if not public.has_role(array['super_admin','director','operations_manager']::public.app_role[]) then
    raise exception 'You do not have permission to approve quotations' using errcode = 'insufficient_privilege';
  end if;

  select * into v_rev from public.quotation_revisions where id = p_revision_id for update;
  if v_rev.id is null then raise exception 'Revision not found'; end if;
  if v_rev.is_locked then raise exception 'Revision is already approved'; end if;
  select * into v_quote from public.quotations where id = v_rev.quotation_id for update;
  if v_quote.current_revision_id <> v_rev.id then raise exception 'Only the current revision can be approved'; end if;
  if v_quote.status in ('converted','cancelled') then raise exception 'Quotation is %', v_quote.status; end if;
  if not exists (select 1 from public.quotation_line_items where revision_id = v_rev.id) then
    raise exception 'A revision needs at least one line item before approval';
  end if;
  if v_rev.created_by = auth.uid()
     and not coalesce((public.get_setting('allow_self_approval'))::boolean, false) then
    raise exception 'Self-approval is disabled. Another approver must approve this revision.';
  end if;

  v_snap := jsonb_build_object(
    'quote_number', v_quote.quote_number,
    'revision_no',  v_rev.revision_no,
    'customer_id',  v_quote.customer_id,
    'customer_code', v_quote.customer_code_at_issue,
    'title', v_quote.title,
    'currency', v_quote.currency,
    'customer_reference', v_quote.customer_reference,
    'valid_until', v_quote.valid_until,
    'terms', jsonb_build_object('scope', v_rev.scope_summary, 'delivery', v_rev.delivery_terms,
                                'payment', v_rev.payment_terms, 'commercial', v_rev.commercial_terms,
                                'exclusions', v_rev.exclusions),
    'subtotal', v_rev.subtotal,
    'lines', (select jsonb_agg(to_jsonb(l) order by l.line_no)
                from public.quotation_line_items l where l.revision_id = v_rev.id),
    'approved_by', auth.uid(),
    'approved_at', now());

  update public.quotation_revisions
     set status = 'approved', snapshot = v_snap, approved_by = auth.uid(),
         approved_at = now(), approval_notes = p_notes, is_locked = true
   where id = v_rev.id
  returning * into v_rev;

  update public.quotations set status = 'approved' where id = v_quote.id;
  return v_rev;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: start a new revision from the latest approved one (copies lines)
-- ---------------------------------------------------------------------------
create or replace function public.create_quotation_revision(p_quotation_id uuid, p_reason text)
returns public.quotation_revisions
language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotations;
  v_prev  public.quotation_revisions;
  v_new   public.quotation_revisions;
begin
  if not public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]) then
    raise exception 'You do not have permission to revise quotations' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'A revision reason is required'; end if;

  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if v_quote.id is null then raise exception 'Quotation not found'; end if;
  if v_quote.status in ('converted','cancelled') then
    raise exception 'A % quotation cannot be revised. Use a change order on the sales order.', v_quote.status;
  end if;
  select * into v_prev from public.quotation_revisions where id = v_quote.current_revision_id;
  if not v_prev.is_locked then
    raise exception 'The current revision is still a draft. Edit it instead of creating a new one.';
  end if;

  insert into public.quotation_revisions (quotation_id, revision_no, reason, scope_summary, delivery_terms,
                                          payment_terms, commercial_terms, exclusions)
  values (v_quote.id, v_prev.revision_no + 1, trim(p_reason), v_prev.scope_summary, v_prev.delivery_terms,
          v_prev.payment_terms, v_prev.commercial_terms, v_prev.exclusions)
  returning * into v_new;

  insert into public.quotation_line_items (revision_id, line_no, line_type, description, manufacturer,
           part_number, model, quantity, unit, unit_price, discount_pct, delivery_note, notes)
  select v_new.id, line_no, line_type, description, manufacturer, part_number, model, quantity, unit,
         unit_price, discount_pct, delivery_note, notes
    from public.quotation_line_items where revision_id = v_prev.id;

  insert into public.quotation_line_costs (line_item_id, unit_cost, freight, duties, other_direct,
                                           pricing_method, pricing_value, supplier_quote_line_id, notes)
  select nl.id, c.unit_cost, c.freight, c.duties, c.other_direct, c.pricing_method, c.pricing_value,
         c.supplier_quote_line_id, c.notes
    from public.quotation_line_items ol
    join public.quotation_line_costs c on c.line_item_id = ol.id
    join public.quotation_line_items nl on nl.revision_id = v_new.id and nl.line_no = ol.line_no
   where ol.revision_id = v_prev.id;

  update public.quotation_revisions set status = 'superseded' where id = v_prev.id;

  update public.quotations
     set current_revision_id = v_new.id,
         status = case when status in ('accepted','sent','customer_reviewing','approved','rejected','expired')
                       then 'draft' else status end,
         accepted_revision_id = null
   where id = v_quote.id;

  select * into v_new from public.quotation_revisions where id = v_new.id;
  return v_new;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: record customer acceptance of the current approved revision
-- ---------------------------------------------------------------------------
create or replace function public.accept_quotation(p_quotation_id uuid, p_revision_id uuid)
returns public.quotations
language plpgsql security definer set search_path = public as $$
declare
  v_quote public.quotations;
  v_rev   public.quotation_revisions;
begin
  if not public.has_role(array['super_admin','director','operations_manager','sales_rep']::public.app_role[]) then
    raise exception 'You do not have permission to record acceptance' using errcode = 'insufficient_privilege';
  end if;
  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if v_quote.id is null then raise exception 'Quotation not found'; end if;
  select * into v_rev from public.quotation_revisions where id = p_revision_id and quotation_id = v_quote.id;
  if v_rev.id is null then raise exception 'Revision does not belong to this quotation'; end if;
  if not v_rev.is_locked or v_rev.status <> 'approved' then
    raise exception 'Only an approved revision can be accepted';
  end if;
  if v_quote.current_revision_id <> v_rev.id then
    raise exception 'Only the current revision can be accepted';
  end if;
  if v_quote.status not in ('approved','sent','customer_reviewing') then
    raise exception 'Quotation status % cannot move to accepted', v_quote.status;
  end if;
  update public.quotations set status = 'accepted', accepted_revision_id = v_rev.id
   where id = v_quote.id returning * into v_quote;
  return v_quote;
end $$;

-- ---------------------------------------------------------------------------
-- RPC: convert the accepted revision into a sales order (transaction-safe,
-- idempotent). Returns the existing order if the quotation was already
-- converted (double-click / retry protection).
-- PO-versus-quote comparison UI arrives in Phase 6; p_po_mismatch lets the
-- caller flag a mismatch, which parks the order in review and blocks
-- downstream purchasing.
-- ---------------------------------------------------------------------------
create or replace function public.convert_quotation_to_order(
  p_quotation_id    uuid,
  p_customer_po_id  uuid,
  p_idempotency_key text default null,
  p_po_mismatch     boolean default false
) returns public.sales_orders
language plpgsql security definer set search_path = public as $$
declare
  v_quote    public.quotations;
  v_rev      public.quotation_revisions;
  v_po       public.customer_purchase_orders;
  v_existing public.sales_orders;
  v_customer public.customers;
  v_year     int := public.business_year();
  v_seq      int;
  v_types    public.line_type[];
  v_order    public.sales_orders;
begin
  if not public.has_role(array['super_admin','director','operations_manager']::public.app_role[]) then
    raise exception 'You do not have permission to convert quotations' using errcode = 'insufficient_privilege';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from public.sales_orders where idempotency_key = p_idempotency_key;
    if v_existing.id is not null then return v_existing; end if;
  end if;

  -- Serialize conversions of the same quotation.
  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if v_quote.id is null then raise exception 'Quotation not found'; end if;

  select * into v_existing from public.sales_orders where source_quotation_id = v_quote.id;
  if v_existing.id is not null then return v_existing; end if;

  if v_quote.status <> 'accepted' or v_quote.accepted_revision_id is null then
    raise exception 'Only an accepted quotation can be converted (current status: %)', v_quote.status;
  end if;

  select * into v_rev from public.quotation_revisions where id = v_quote.accepted_revision_id;
  if not v_rev.is_locked or v_rev.status <> 'approved' then
    raise exception 'The accepted revision is not approved and locked';
  end if;

  select * into v_po from public.customer_purchase_orders where id = p_customer_po_id;
  if v_po.id is null then raise exception 'Customer purchase order not found'; end if;
  if v_po.customer_id <> v_quote.customer_id then
    raise exception 'Customer PO belongs to a different customer than the quotation';
  end if;

  select * into v_customer from public.customers where id = v_quote.customer_id for share;

  select array_agg(distinct line_type) into v_types
    from public.quotation_line_items where revision_id = v_rev.id;

  v_seq := public.next_sales_order_sequence(v_customer.id, v_year);

  insert into public.sales_orders (order_number, customer_id, customer_code_at_issue, year, sequence,
         source_quotation_id, source_revision_id, customer_po_id, order_type, status, currency,
         total_amount, snapshot, idempotency_key)
  values (format('ANA-%s-P-%s-%s', v_customer.customer_code, v_year, lpad(v_seq::text, 4, '0')),
          v_customer.id, v_customer.customer_code, v_year, v_seq,
          v_quote.id, v_rev.id, v_po.id,
          case when v_types @> array['product','service']::public.line_type[] then 'mixed'
               when v_types @> array['service']::public.line_type[] then 'service'
               else 'product' end::public.order_type,
          case when p_po_mismatch then 'po_mismatch_review' else 'open' end::public.sales_order_status,
          v_quote.currency, v_rev.subtotal, v_rev.snapshot, p_idempotency_key)
  returning * into v_order;

  insert into public.sales_order_lines (sales_order_id, source_quote_line_id, line_no, line_type, description,
         manufacturer, part_number, model, quantity, unit, unit_price, discount_pct)
  select v_order.id, l.id, l.line_no, l.line_type, l.description, l.manufacturer, l.part_number, l.model,
         l.quantity, l.unit, l.unit_price, l.discount_pct
    from public.quotation_line_items l where l.revision_id = v_rev.id;

  update public.customer_purchase_orders set quotation_id = v_quote.id where id = v_po.id;
  update public.quotations set status = 'converted' where id = v_quote.id;

  return v_order;
end $$;
