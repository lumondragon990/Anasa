-- ============================================================================
-- ANASA COMMAND CENTER — Migration 0005
--   1. One step from "customer sent a PO" to "approved for sale":
--      record_customer_po() accepts the approved quotation, stores the
--      customer's PO and converts it into a sales order (ANA-XXX-P-…).
--   2. Payments against sales orders, with the order's payment status
--      (unpaid / partially paid / paid) kept up to date automatically.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Payment status on sales orders
-- ---------------------------------------------------------------------------
alter table public.sales_orders
  add column amount_paid    numeric(18,2) not null default 0 check (amount_paid >= 0),
  add column payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid','partially_paid','paid')),
  add column paid_at        timestamptz,
  add column po_review_note text,
  add column po_reviewed_by uuid references public.profiles (id),
  add column po_reviewed_at timestamptz;

create index sales_orders_payment_idx on public.sales_orders (payment_status, converted_at desc);

create type public.payment_method as enum ('transfer','check','card','cash','other');

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  sales_order_id  uuid not null references public.sales_orders (id) on delete restrict,
  amount          numeric(18,2) not null check (amount > 0),
  currency        char(3) not null check (currency ~ '^[A-Z]{3}$'),
  paid_on         date not null default current_date,
  method          public.payment_method not null default 'transfer',
  reference       text,
  notes           text,
  recorded_by     uuid references public.profiles (id) default auth.uid(),
  created_at      timestamptz not null default now()
);
create index payments_order_idx on public.payments (sales_order_id, paid_on);
create trigger audit_payments after insert or update or delete on public.payments
  for each row execute function public.audit_row();

-- Payments must be in the order's currency and may not exceed what is owed.
create or replace function public.payments_validate()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_order public.sales_orders;
  v_paid  numeric(18,2);
begin
  select * into v_order from public.sales_orders where id = new.sales_order_id for update;
  if v_order.id is null then raise exception 'Sales order not found'; end if;
  if v_order.status = 'cancelled' then raise exception 'Payments cannot be recorded on a cancelled order'; end if;
  if new.currency <> v_order.currency then
    raise exception 'Payment currency must match the order currency (%)', v_order.currency;
  end if;
  select coalesce(sum(amount), 0) into v_paid from public.payments where sales_order_id = new.sales_order_id;
  if v_paid + new.amount > v_order.total_amount then
    raise exception 'This payment is more than the balance due (% %)', v_order.currency, (v_order.total_amount - v_paid);
  end if;
  return new;
end $$;
create trigger payments_validate before insert on public.payments
  for each row execute function public.payments_validate();

-- Payments are not edited; a wrong one is deleted and recorded again.
create or replace function public.payments_no_update()
returns trigger language plpgsql as $$
begin
  raise exception 'Payments cannot be edited. Delete the payment and record it again.';
end $$;
create trigger payments_no_update before update on public.payments
  for each row execute function public.payments_no_update();

create or replace function public.payments_recalc_order()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_id    uuid := coalesce(new.sales_order_id, old.sales_order_id);
  v_paid  numeric(18,2);
  v_total numeric(18,2);
begin
  select coalesce(sum(amount), 0) into v_paid from public.payments where sales_order_id = v_id;
  select total_amount into v_total from public.sales_orders where id = v_id;
  update public.sales_orders
     set amount_paid    = v_paid,
         payment_status = case when v_paid <= 0 then 'unpaid'
                               when v_paid >= v_total then 'paid'
                               else 'partially_paid' end,
         paid_at        = case when v_paid >= v_total and v_paid > 0
                               then coalesce(paid_at, now()) else null end
   where id = v_id;
  return null;
end $$;
create trigger payments_recalc_order after insert or delete on public.payments
  for each row execute function public.payments_recalc_order();

-- ---------------------------------------------------------------------------
-- One step: customer PO received → approved for sale
-- ---------------------------------------------------------------------------
create or replace function public.record_customer_po(
  p_quotation_id    uuid,
  p_po_number       text,
  p_po_date         date default null,
  p_po_total        numeric default null,
  p_notes           text default null,
  p_idempotency_key text default null
) returns public.sales_orders
language plpgsql security definer set search_path = public as $$
declare
  v_quote    public.quotations;
  v_rev      public.quotation_revisions;
  v_po_id    uuid;
  v_mismatch boolean;
  v_order    public.sales_orders;
begin
  if not public.has_role(array['super_admin','director','operations_manager']::public.app_role[]) then
    raise exception 'You do not have permission to convert quotations' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_po_number), '') = '' then raise exception 'Enter the customer’s PO number'; end if;

  -- Retry / double-click: return the order already created for this request or quotation.
  if p_idempotency_key is not null then
    select * into v_order from public.sales_orders where idempotency_key = p_idempotency_key;
    if v_order.id is not null then return v_order; end if;
  end if;

  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if v_quote.id is null then raise exception 'Quotation not found'; end if;

  select * into v_order from public.sales_orders where source_quotation_id = v_quote.id;
  if v_order.id is not null then return v_order; end if;

  if v_quote.status in ('approved','sent','customer_reviewing') then
    perform public.accept_quotation(v_quote.id, v_quote.current_revision_id);
    select * into v_quote from public.quotations where id = p_quotation_id;
  end if;
  if v_quote.status <> 'accepted' then
    raise exception 'Approve the quotation before recording the customer’s PO';
  end if;

  select * into v_rev from public.quotation_revisions where id = v_quote.accepted_revision_id;

  select id into v_po_id from public.customer_purchase_orders
   where customer_id = v_quote.customer_id and po_number = trim(p_po_number);
  if v_po_id is not null then
    raise exception 'PO % is already recorded for this customer', trim(p_po_number) using errcode = 'unique_violation';
  end if;

  insert into public.customer_purchase_orders (customer_id, po_number, po_date, currency, total_amount, quotation_id, notes)
  values (v_quote.customer_id, trim(p_po_number), p_po_date, v_quote.currency, p_po_total, v_quote.id, nullif(trim(p_notes), ''))
  returning id into v_po_id;

  -- A PO total that differs from the accepted quotation parks the order for review.
  v_mismatch := p_po_total is not null and round(p_po_total, 2) <> round(v_rev.subtotal, 2);

  v_order := public.convert_quotation_to_order(v_quote.id, v_po_id, p_idempotency_key, v_mismatch);
  return v_order;
end $$;

-- Accept the differences between the customer PO and the quotation.
-- p_use_po_total: collect the PO's total instead of the quotation's (e.g. an
-- agreed discount). Order lines keep the quotation's prices for traceability.
create or replace function public.resolve_po_mismatch(p_sales_order_id uuid, p_note text, p_use_po_total boolean default false)
returns public.sales_orders
language plpgsql security definer set search_path = public as $$
declare
  v_order public.sales_orders;
  v_po_total numeric(18,2);
begin
  if not public.has_role(array['super_admin','director','operations_manager']::public.app_role[]) then
    raise exception 'You do not have permission to approve PO differences' using errcode = 'insufficient_privilege';
  end if;
  if coalesce(trim(p_note), '') = '' then raise exception 'Explain why the PO differences are accepted'; end if;
  select po.total_amount into v_po_total
    from public.sales_orders so join public.customer_purchase_orders po on po.id = so.customer_po_id
   where so.id = p_sales_order_id;
  update public.sales_orders
     set status = 'open', po_review_note = trim(p_note), po_reviewed_by = auth.uid(), po_reviewed_at = now(),
         total_amount = case when p_use_po_total and v_po_total is not null and v_po_total >= amount_paid
                             then v_po_total else total_amount end
   where id = p_sales_order_id and status = 'po_mismatch_review'
  returning * into v_order;
  if v_order.id is null then raise exception 'This order is not waiting for PO review'; end if;
  return v_order;
end $$;

-- ---------------------------------------------------------------------------
-- RLS and grants
-- ---------------------------------------------------------------------------
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant select, insert, delete on public.payments to authenticated;

create policy payments_select on public.payments
  for select to authenticated using (public.is_internal());
create policy payments_insert on public.payments
  for insert to authenticated
  with check (public.has_role(array['super_admin','director','operations_manager','finance_manager']::public.app_role[])
              and recorded_by = auth.uid());
create policy payments_delete on public.payments
  for delete to authenticated
  using (public.has_role(array['super_admin','director','finance_manager']::public.app_role[]));

grant execute on function public.record_customer_po(uuid, text, date, numeric, text, text) to authenticated;
grant execute on function public.resolve_po_mismatch(uuid, text, boolean) to authenticated;
revoke execute on function public.record_customer_po(uuid, text, date, numeric, text, text) from public, anon;
revoke execute on function public.resolve_po_mismatch(uuid, text, boolean) from public, anon;
revoke execute on function public.payments_validate() from public, anon;
revoke execute on function public.payments_recalc_order() from public, anon;
revoke execute on function public.payments_no_update() from public, anon;
