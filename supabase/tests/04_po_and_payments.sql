-- ============================================================================
-- Tests for migration 0005: record customer PO → sales order; payments.
-- ============================================================================
\set QUIET on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- An approved quotation for ART worth 30,000.00
do $$ declare q public.quotations; begin
  q := public.create_quotation((select id from t.ctx where key='art'), 'PO flow quote');
  insert into public.quotation_line_items (revision_id, line_no, line_type, description, quantity, unit_price)
    values (q.current_revision_id, 1, 'service', 'Field testing', 1, 30000);
  perform public.approve_quotation_revision(q.current_revision_id);
end $$;

-- Draft quotation cannot take a PO
do $$ declare q public.quotations; begin
  q := public.create_quotation((select id from t.ctx where key='art'), 'Draft only');
end $$;
select t.expect_error($q$select public.record_customer_po((select id from public.quotations where title='Draft only'), 'ART-PO-0')$q$, 'approve the quotation');

-- Record PO with matching total → approved for sale (open), unpaid
select public.record_customer_po((select id from public.quotations where title='PO flow quote'), 'ART-PO-778', current_date, 30000, 'Signed by plant manager', 'po-click-1');
select public.record_customer_po((select id from public.quotations where title='PO flow quote'), 'ART-PO-778', current_date, 30000, null, 'po-click-2');  -- double click
do $$ declare o public.sales_orders; begin
  assert (select count(*) from public.sales_orders so join public.quotations q on q.id = so.source_quotation_id where q.title='PO flow quote') = 1, 'one order';
  select so.* into o from public.sales_orders so join public.quotations q on q.id = so.source_quotation_id where q.title='PO flow quote';
  assert o.status = 'open', 'approved for sale';
  assert o.payment_status = 'unpaid' and o.amount_paid = 0, 'unpaid';
  assert (select status from public.quotations where title='PO flow quote') = 'converted', 'quote converted';
  assert (select po_number from public.customer_purchase_orders where id = o.customer_po_id) = 'ART-PO-778', 'PO linked';
  insert into t.ctx values ('order1', o.id);
end $$;

-- Payments: partial, then full; overpay and wrong currency blocked
insert into public.payments (sales_order_id, amount, currency, reference) values ((select id from t.ctx where key='order1'), 10000, 'USD', 'Wire 1');
do $$ begin
  assert (select payment_status from public.sales_orders where id = (select id from t.ctx where key='order1')) = 'partially_paid', 'partial';
  assert (select amount_paid from public.sales_orders where id = (select id from t.ctx where key='order1')) = 10000, 'amount paid';
end $$;
select t.expect_error($q$insert into public.payments (sales_order_id, amount, currency) values ((select id from t.ctx where key='order1'), 25000, 'USD')$q$, 'balance due');
select t.expect_error($q$insert into public.payments (sales_order_id, amount, currency) values ((select id from t.ctx where key='order1'), 100, 'MXN')$q$, 'currency must match');
insert into public.payments (sales_order_id, amount, currency, reference) values ((select id from t.ctx where key='order1'), 20000, 'USD', 'Wire 2');
do $$ begin
  assert (select payment_status from public.sales_orders where id = (select id from t.ctx where key='order1')) = 'paid', 'paid';
  assert (select paid_at from public.sales_orders where id = (select id from t.ctx where key='order1')) is not null, 'paid_at set';
end $$;
select t.expect_error($q$update public.payments set amount = 1 where reference = 'Wire 2'$q$, 'permission denied');

-- Deleting a payment moves the order back to partially paid
delete from public.payments where reference = 'Wire 2';
do $$ begin
  assert (select payment_status from public.sales_orders where id = (select id from t.ctx where key='order1')) = 'partially_paid', 'back to partial';
  assert (select paid_at from public.sales_orders where id = (select id from t.ctx where key='order1')) is null, 'paid_at cleared';
end $$;

-- PO total different from the quotation → review required, then resolved
do $$ declare q public.quotations; begin
  q := public.create_quotation((select id from t.ctx where key='art'), 'Mismatch quote');
  insert into public.quotation_line_items (revision_id, line_no, description, quantity, unit_price) values (q.current_revision_id, 1, 'x', 1, 5000);
  perform public.approve_quotation_revision(q.current_revision_id);
end $$;
select public.record_customer_po((select id from public.quotations where title='Mismatch quote'), 'ART-PO-779', null, 4500);
do $$ begin
  assert (select so.status from public.sales_orders so join public.quotations q on q.id = so.source_quotation_id where q.title='Mismatch quote') = 'po_mismatch_review', 'mismatch';
end $$;
select t.expect_error($q$select public.resolve_po_mismatch((select so.id from public.sales_orders so join public.quotations q on q.id=so.source_quotation_id where q.title='Mismatch quote'), '')$q$, 'explain');
select public.resolve_po_mismatch((select so.id from public.sales_orders so join public.quotations q on q.id=so.source_quotation_id where q.title='Mismatch quote'), 'Customer took 10% discount by phone', true);
do $$ begin
  assert (select so.status from public.sales_orders so join public.quotations q on q.id = so.source_quotation_id where q.title='Mismatch quote') = 'open', 'resolved';
  assert (select so.total_amount from public.sales_orders so join public.quotations q on q.id = so.source_quotation_id where q.title='Mismatch quote') = 4500, 'collect PO total';
end $$;

-- Same PO number twice for the same customer is refused
do $$ declare q public.quotations; begin
  q := public.create_quotation((select id from t.ctx where key='art'), 'Dup PO quote');
  insert into public.quotation_line_items (revision_id, line_no, description, quantity, unit_price) values (q.current_revision_id, 1, 'x', 1, 1);
  perform public.approve_quotation_revision(q.current_revision_id);
end $$;
select t.expect_error($q$select public.record_customer_po((select id from public.quotations where title='Dup PO quote'), 'ART-PO-778')$q$, 'already recorded');

-- Roles: sales rep and employee can see orders and payments but not record them
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select t.expect_error($q$select public.record_customer_po((select id from public.quotations where title='Dup PO quote'), 'X-1')$q$, 'permission');
select t.expect_error($q$insert into public.payments (sales_order_id, amount, currency, recorded_by) values ((select id from t.ctx where key='order1'), 1, 'USD', '00000000-0000-0000-0000-00000000000b')$q$, 'row-level security');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  assert (select count(*) from public.payments) = 1, 'employee can see payments';
end $$;
reset role;
\echo 'PO and payment tests passed'
