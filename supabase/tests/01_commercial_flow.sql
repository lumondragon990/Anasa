-- ============================================================================
-- Database tests: spec Section 32, tests 1–5, 10 (DB layer) and 12 (partial).
-- Run with: npm run test:db   (uses supabase/tests/run_local.sh)
-- Each block raises an exception on failure, which stops psql (ON_ERROR_STOP).
-- ============================================================================
\set QUIET on
\o /dev/null
create schema t;
create table t.ctx (key text primary key, id uuid);
grant usage on schema t to authenticated, anon;
grant select, insert, update on t.ctx to authenticated;

-- expect_error(sql, fragment): passes only if sql raises an error containing fragment
create function t.expect_error(p_sql text, p_fragment text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(lower(p_fragment) in lower(sqlerrm)) = 0 then
      raise exception 'Expected error containing "%", got "%"', p_fragment, sqlerrm;
    end if;
    return;
  end;
  raise exception 'Expected an error containing "%" but statement succeeded: %', p_fragment, p_sql;
end $$;
grant execute on function t.expect_error(text, text) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Users: first becomes super_admin, the rest pending until assigned
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@anasa.test'),
  ('00000000-0000-0000-0000-00000000000b', 'sales@anasa.test'),
  ('00000000-0000-0000-0000-00000000000c', 'employee@anasa.test'),
  ('00000000-0000-0000-0000-00000000000d', 'newcomer@anasa.test');

do $$ begin
  assert (select role from public.profiles where email = 'admin@anasa.test') = 'super_admin', 'first user must be super_admin';
  assert (select role from public.profiles where email = 'sales@anasa.test') = 'pending', 'later users start pending';
end $$;

-- Admin assigns roles through the RPC
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
select public.set_user_role('00000000-0000-0000-0000-00000000000b', 'sales_rep');
select public.set_user_role('00000000-0000-0000-0000-00000000000c', 'employee');
select t.expect_error($q$select public.set_user_role('00000000-0000-0000-0000-00000000000a', 'employee')$q$,
                      'cannot remove your own');

-- ---------------------------------------------------------------------------
-- TEST 1 — company-specific quotation numbering
-- ---------------------------------------------------------------------------
insert into public.customers (customer_code, legal_name, display_name) values
  ('ABC', 'ABC Industrial LLC', 'ABC Industrial'),
  ('XYZ', 'XYZ Energy Inc', 'XYZ Energy'),
  ('GLP', 'Global Power SA', 'Global Power');
insert into t.ctx select 'abc', id from public.customers where customer_code = 'ABC';
insert into t.ctx select 'xyz', id from public.customers where customer_code = 'XYZ';
insert into t.ctx select 'glp', id from public.customers where customer_code = 'GLP';

select public.create_quotation((select id from t.ctx where key = 'abc'), 'Transformer bushings');
select public.create_quotation((select id from t.ctx where key = 'abc'), 'Gaskets');
select public.create_quotation((select id from t.ctx where key = 'xyz'), 'Breaker parts');
select public.create_quotation((select id from t.ctx where key = 'glp'), 'Field service');
select public.create_quotation((select id from t.ctx where key = 'xyz'), 'Relays');

do $$
declare y int := public.business_year();
begin
  assert exists (select 1 from public.quotations where quote_number = format('ANA-ABC-Q-%s-0001', y)), 'ABC 0001';
  assert exists (select 1 from public.quotations where quote_number = format('ANA-ABC-Q-%s-0002', y)), 'ABC 0002';
  assert exists (select 1 from public.quotations where quote_number = format('ANA-XYZ-Q-%s-0001', y)), 'XYZ 0001';
  assert exists (select 1 from public.quotations where quote_number = format('ANA-XYZ-Q-%s-0002', y)), 'XYZ 0002';
  assert exists (select 1 from public.quotations where quote_number = format('ANA-GLP-Q-%s-0001', y)), 'GLP 0001';
  assert (select count(*) from public.quotation_revisions where revision_no = 0) = 5, 'each quote starts at Rev 00';
  raise notice 'TEST 1 passed: independent per-customer sequences';
end $$;

-- Direct inserts of numbered documents are blocked
select t.expect_error($q$insert into public.quotations (quote_number, customer_id, customer_code_at_issue, year, sequence, title)
  values ('ANA-ABC-Q-2026-9999', (select id from t.ctx where key='abc'), 'ABC', 2026, 9999, 'x')$q$, 'permission denied');

-- ---------------------------------------------------------------------------
-- Customer code rules: unique, never reused, changes logged, history preserved
-- ---------------------------------------------------------------------------
select t.expect_error($q$insert into public.customers (customer_code, legal_name, display_name) values ('ABC','Another Co','Another')$q$,
                      'customers_code_unique');
select t.expect_error($q$update public.customers set customer_code = 'ABX' where customer_code = 'ABC'$q$, 'permission denied');

select public.change_customer_code((select id from t.ctx where key='abc'), 'ABX', 'Rebrand');
select public.create_quotation((select id from t.ctx where key = 'abc'), 'Post-rebrand quote');

do $$
declare y int := public.business_year();
begin
  assert exists (select 1 from public.quotations where quote_number = format('ANA-ABC-Q-%s-0001', y)), 'old numbers keep old code';
  assert exists (select 1 from public.quotations where quote_number = format('ANA-ABX-Q-%s-0003', y)), 'sequence continues under new code';
  assert (select count(*) from public.customer_code_history where customer_id = (select id from t.ctx where key='abc')) = 2,
    'initial code + change logged';
  assert (select reason from public.customer_code_history where new_code = 'ABX') = 'Rebrand', 'reason recorded';
  raise notice 'Customer code rules passed';
end $$;

-- The retired code ABC cannot be given to another company
select t.expect_error($q$insert into public.customers (customer_code, legal_name, display_name) values ('ABC','Copycat Co','Copycat')$q$,
                      'cannot be reused');

-- Sales rep cannot change codes
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select t.expect_error($q$select public.change_customer_code((select id from t.ctx where key='abc'), 'ABZ', 'nope')$q$,
                      'only a super administrator');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- ---------------------------------------------------------------------------
-- TEST 2 — revisions keep the primary number; approved revisions are immutable
-- ---------------------------------------------------------------------------
insert into t.ctx select 'q1', id from public.quotations where quote_number like 'ANA-ABC-Q-%-0001';
insert into t.ctx select 'q1r0', current_revision_id from public.quotations where id = (select id from t.ctx where key='q1');

insert into public.quotation_line_items (revision_id, line_no, line_type, description, part_number, quantity, unit, unit_price)
values ((select id from t.ctx where key='q1r0'), 1, 'product', 'HV bushing 69kV', 'BSH-69', 3, 'EA', 4200.00),
       ((select id from t.ctx where key='q1r0'), 2, 'service', 'Installation & testing', null, 1, 'LOT', 6500.00);
insert into public.quotation_line_costs (line_item_id, unit_cost, freight, pricing_method, pricing_value)
select id, 3000, 150, 'markup', 0.35 from public.quotation_line_items where revision_id = (select id from t.ctx where key='q1r0') and line_no = 1;

do $$ begin
  assert (select subtotal from public.quotation_revisions where id = (select id from t.ctx where key='q1r0')) = 19100.00,
    'subtotal = 3*4200 + 6500';
end $$;

select public.approve_quotation_revision((select id from t.ctx where key='q1r0'), 'OK to issue');
select t.expect_error($q$update public.quotation_line_items set unit_price = 1 where revision_id = (select id from t.ctx where key='q1r0')$q$,
                      'approved revision');
-- RLS hides locked revisions from UPDATE (0 rows affected) ...
update public.quotation_revisions set scope_summary = 'changed' where id = (select id from t.ctx where key='q1r0');
do $$ begin
  assert (select scope_summary from public.quotation_revisions where id = (select id from t.ctx where key='q1r0')) is null,
    'locked revision unchanged';
end $$;

select public.create_quotation_revision((select id from t.ctx where key='q1'), 'Customer asked for 4 bushings');
insert into t.ctx select 'q1r1', current_revision_id from public.quotations where id = (select id from t.ctx where key='q1');
update public.quotation_line_items set quantity = 4 where revision_id = (select id from t.ctx where key='q1r1') and line_no = 1;
select public.approve_quotation_revision((select id from t.ctx where key='q1r1'));

select public.create_quotation_revision((select id from t.ctx where key='q1'), 'Discount agreed');
insert into t.ctx select 'q1r2', current_revision_id from public.quotations where id = (select id from t.ctx where key='q1');
update public.quotation_line_items set discount_pct = 5 where revision_id = (select id from t.ctx where key='q1r2') and line_no = 2;
select public.approve_quotation_revision((select id from t.ctx where key='q1r2'));

do $$ begin
  assert (select count(*) from public.quotation_revisions where quotation_id = (select id from t.ctx where key='q1')) = 3, 'Rev 00/01/02';
  assert (select status from public.quotation_revisions where id = (select id from t.ctx where key='q1r0')) = 'superseded', 'rev0 superseded';
  assert (select (snapshot->'lines'->0->>'quantity')::numeric from public.quotation_revisions where id = (select id from t.ctx where key='q1r0')) = 3,
    'Rev 00 snapshot keeps original quantity';
  assert (select subtotal from public.quotation_revisions where id = (select id from t.ctx where key='q1r2')) = 22975.00,
    'Rev 02 subtotal = 4*4200 + 6500*0.95 = 22975';
  assert exists (select 1 from public.quotation_line_costs c join public.quotation_line_items l on l.id = c.line_item_id
                 where l.revision_id = (select id from t.ctx where key='q1r2') and c.unit_cost = 3000), 'costs carried to new revision';
  raise notice 'TEST 2 passed: revisions preserved and immutable';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 3 — conversion keeps quote, revision, PO and order linked; idempotent
-- ---------------------------------------------------------------------------
select t.expect_error($q$select public.convert_quotation_to_order((select id from t.ctx where key='q1'), gen_random_uuid())$q$,
                      'only an accepted quotation');
select public.accept_quotation((select id from t.ctx where key='q1'), (select id from t.ctx where key='q1r2'));
insert into public.customer_purchase_orders (customer_id, po_number, total_amount)
values ((select id from t.ctx where key='abc'), 'ABC-PO-45872', 22975.00);
insert into t.ctx select 'po1', id from public.customer_purchase_orders where po_number = 'ABC-PO-45872';

-- PO of a different customer is rejected
insert into public.customer_purchase_orders (customer_id, po_number) values ((select id from t.ctx where key='xyz'), 'XYZ-PO-1');
select t.expect_error($q$select public.convert_quotation_to_order((select id from t.ctx where key='q1'),
  (select id from public.customer_purchase_orders where po_number='XYZ-PO-1'))$q$, 'different customer');

select public.convert_quotation_to_order((select id from t.ctx where key='q1'), (select id from t.ctx where key='po1'), 'click-1');
select public.convert_quotation_to_order((select id from t.ctx where key='q1'), (select id from t.ctx where key='po1'), 'click-2'); -- double click
select public.convert_quotation_to_order((select id from t.ctx where key='q1'), (select id from t.ctx where key='po1'), 'click-1'); -- retry

do $$
declare y int := public.business_year(); o public.sales_orders;
begin
  assert (select count(*) from public.sales_orders) = 1, 'exactly one order despite retries';
  select * into o from public.sales_orders;
  -- The customer code is now ABX, so the order uses the current authorized code.
  assert o.order_number = format('ANA-ABX-P-%s-0001', y), 'order number ' || o.order_number;
  assert o.source_revision_id = (select id from t.ctx where key='q1r2'), 'linked to exact accepted revision (Rev 02)';
  assert o.customer_po_id = (select id from t.ctx where key='po1'), 'linked to customer PO';
  assert o.order_type = 'mixed', 'product + service lines → mixed';
  assert o.total_amount = 22975.00, 'order total equals accepted revision';
  assert (select count(*) from public.sales_order_lines where sales_order_id = o.id) = 2, 'lines copied';
  assert (select status from public.quotations where id = (select id from t.ctx where key='q1')) = 'converted', 'quote marked converted';
  raise notice 'TEST 3 passed: transaction-safe, idempotent conversion';
end $$;

select t.expect_error($q$select public.create_quotation_revision((select id from t.ctx where key='q1'), 'late change')$q$,
                      'change order');

-- ---------------------------------------------------------------------------
-- TEST 4 — order sequence is independent of quote sequence
-- XYZ: 10 quotes total, convert 3 (the 2nd, 5th and 9th) → P-0001..0003
-- ---------------------------------------------------------------------------
do $$
declare
  c uuid := (select id from t.ctx where key='xyz');
  q public.quotations; r uuid; po uuid; i int; y int := public.business_year();
begin
  for i in 3..10 loop perform public.create_quotation(c, 'XYZ quote ' || i); end loop;
  foreach i in array array[2,5,9] loop
    select * into q from public.quotations where customer_id = c and sequence = i;
    r := q.current_revision_id;
    insert into public.quotation_line_items (revision_id, line_no, description, quantity, unit_price)
      values (r, 1, 'Item for quote ' || i, 1, 100 * i);
    perform public.approve_quotation_revision(r);
    perform public.accept_quotation(q.id, r);
    insert into public.customer_purchase_orders (customer_id, po_number) values (c, 'XYZ-PO-Q' || i) returning id into po;
    perform public.convert_quotation_to_order(q.id, po);
  end loop;
  assert (select count(*) from public.quotations where customer_id = c) = 10, 'ten XYZ quotes';
  assert (select array_agg(order_number order by sequence) from public.sales_orders where customer_id = c)
       = array[format('ANA-XYZ-P-%s-0001',y), format('ANA-XYZ-P-%s-0002',y), format('ANA-XYZ-P-%s-0003',y)],
       'orders numbered 0001..0003';
  assert (select q2.sequence from public.sales_orders so join public.quotations q2 on q2.id = so.source_quotation_id
           where so.order_number = format('ANA-XYZ-P-%s-0003',y)) = 9, 'P-0003 came from Q-0009 via FK, not by number';
  raise notice 'TEST 4 passed: independent order numbering';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 5 (DB layer) — flagged PO mismatch parks the order in review
-- ---------------------------------------------------------------------------
do $$
declare c uuid := (select id from t.ctx where key='glp'); q public.quotations; po uuid; o public.sales_orders;
begin
  select * into q from public.quotations where customer_id = c and sequence = 1;
  insert into public.quotation_line_items (revision_id, line_no, line_type, description, quantity, unit, unit_price)
    values (q.current_revision_id, 1, 'service', 'Oil processing', 1, 'LOT', 12000);
  perform public.approve_quotation_revision(q.current_revision_id);
  perform public.accept_quotation(q.id, q.current_revision_id);
  insert into public.customer_purchase_orders (customer_id, po_number, total_amount) values (c, 'GLP-7781', 11000) returning id into po;
  o := public.convert_quotation_to_order(q.id, po, null, true);
  assert o.status = 'po_mismatch_review', 'mismatch flagged';
  assert o.order_type = 'service', 'service order';
  raise notice 'TEST 5 (DB layer) passed: mismatch status';
end $$;

-- ---------------------------------------------------------------------------
-- TEST 10 (DB layer) — role isolation
-- ---------------------------------------------------------------------------
-- Employee: can read customers and quotes, cannot see costs, cannot create quotes
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
do $$ begin
  assert (select count(*) from public.customers) = 3, 'employee sees customers';
  assert (select count(*) from public.quotation_line_costs) = 0, 'employee cannot see supplier costs';
end $$;
select t.expect_error($q$select public.create_quotation((select id from t.ctx where key='glp'), 'x')$q$, 'permission');
select t.expect_error($q$select public.approve_quotation_revision(gen_random_uuid())$q$, 'permission');
do $$ begin
  assert (select count(*) from public.audit_logs) = 0, 'employee cannot read audit log';
end $$;

-- Sales rep: sees costs, can quote, cannot approve or convert
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.quotation_line_costs) > 0, 'sales rep sees costs';
end $$;
select public.create_quotation((select id from t.ctx where key='glp'), 'Sales rep quote');
select t.expect_error($q$select public.approve_quotation_revision((select current_revision_id from public.quotations where title='Sales rep quote'))$q$, 'permission');
select t.expect_error($q$select public.convert_quotation_to_order(gen_random_uuid(), gen_random_uuid())$q$, 'permission');

-- Pending user: sees nothing
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000d', false);
do $$ begin
  assert (select count(*) from public.customers) = 0, 'pending user sees no customers';
  assert (select count(*) from public.quotations) = 0, 'pending user sees no quotations';
end $$;

-- Anonymous: no table access at all
reset role;
set role anon;
select t.expect_error($q$select count(*) from public.customers$q$, 'permission denied');
reset role;

do $$ begin
  assert (select count(*) from public.audit_logs where table_name = 'quotations') > 0, 'audit trail written';
  raise notice 'TEST 10 (DB layer) passed: role isolation';
end $$;

\echo 'commercial flow tests passed'

-- ... and the trigger blocks it even for a superuser bypassing RLS.
select t.expect_error($q$update public.quotation_revisions set scope_summary = 'changed' where revision_no = 0 and is_locked$q$, 'locked');
