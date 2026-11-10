-- ============================================================================
-- Tests for migration 0004: manual numbers, reserved code, supplier quotes,
-- documents and storage policies. Runs after 01_commercial_flow.sql.
-- ============================================================================
\set QUIET on
\o /dev/null
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);

-- 'ANA' cannot be a new customer code
select t.expect_error($q$insert into public.customers (customer_code, legal_name, display_name) values ('ANA','Arteche','Arteche')$q$, 'document prefix');
do $$ begin assert not public.customer_code_available('ANA'), 'ANA not available'; end $$;

-- Manual number at creation
insert into public.customers (customer_code, legal_name, display_name, billing_country) values ('ART', 'Arteche North America SA de CV', 'Arteche', 'Mexico');
insert into t.ctx select 'art', id from public.customers where customer_code = 'ART';
select public.create_quotation((select id from t.ctx where key='art'), 'Legacy quote', p_manual_number => 'tq-2026-118', p_manual_reason => 'Carried over from old system');
do $$ begin
  assert exists (select 1 from public.quotations where quote_number = 'TQ-2026-118' and is_manual_number and sequence = 0), 'manual number normalized and stored';
  assert (select reason from public.quotation_number_history h join public.quotations q on q.id = h.quotation_id where q.quote_number = 'TQ-2026-118') = 'Carried over from old system', 'reason logged';
end $$;
select t.expect_error($q$select public.create_quotation((select id from t.ctx where key='art'), 'x', p_manual_number => 'TQ-2026-118', p_manual_reason => 'dup')$q$, 'already in use');
select t.expect_error($q$select public.create_quotation((select id from t.ctx where key='art'), 'x', p_manual_number => 'ANA-ART-Q-2026-0099')$q$, 'reason is required');

-- A manual number that looks like the next automatic one is skipped by the generator
select public.create_quotation((select id from t.ctx where key='art'), 'Squatter', p_manual_number => format('ANA-ART-Q-%s-0001', public.business_year()), p_manual_reason => 'test');
select public.create_quotation((select id from t.ctx where key='art'), 'Automatic');
do $$ begin
  assert (select quote_number from public.quotations where title = 'Automatic') = format('ANA-ART-Q-%s-0002', public.business_year()),
    'automatic numbering skips a number already taken by hand';
end $$;

-- Renumber a draft; history recorded
select public.renumber_quotation((select id from public.quotations where title = 'Automatic'), 'ana-art-q-2026-0500', 'Match customer RFQ');
do $$ begin
  assert exists (select 1 from public.quotations where quote_number = 'ANA-ART-Q-2026-0500' and title = 'Automatic'), 'renumbered';
  assert (select count(*) from public.quotation_number_history h join public.quotations q on q.id = h.quotation_id where q.title = 'Automatic') = 2, 'two history rows';
  assert (select old_number from public.quotation_number_history h join public.quotations q on q.id = h.quotation_id where q.title = 'Automatic' and h.reason = 'Match customer RFQ')
         = format('ANA-ART-Q-%s-0002', public.business_year()), 'old number kept in history';
end $$;
-- Direct update of the number is still blocked
select t.expect_error($q$update public.quotations set title = title, quote_number = 'HACK-1' where title = 'Automatic'$q$, 'permission denied');

-- Approved quotations cannot be renumbered
do $$ declare q public.quotations; begin
  select * into q from public.quotations where title = 'Automatic';
  insert into public.quotation_line_items (revision_id, line_no, description, quantity, unit_price) values (q.current_revision_id, 1, 'x', 1, 100);
  perform public.approve_quotation_revision(q.current_revision_id);
end $$;
select t.expect_error($q$select public.renumber_quotation((select id from public.quotations where title = 'Automatic'), 'NEW-1', 'late')$q$, 'permanent');

-- Sales rep cannot set or change numbers
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
select t.expect_error($q$select public.create_quotation((select id from t.ctx where key='art'), 'x', p_manual_number => 'SR-1', p_manual_reason => 'r')$q$, 'only a super administrator');
select t.expect_error($q$select public.renumber_quotation((select id from public.quotations where title = 'Legacy quote'), 'SR-2', 'r')$q$, 'only a super administrator');

-- Supplier quotes: sales rep can record; employee cannot see
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
insert into public.suppliers (supplier_code, legal_name, display_name) values ('HVB', 'HV Bushings Inc', 'HV Bushings');
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.supplier_quotes (supplier_id, quotation_id, supplier_quote_number, total_amount, currency)
values ((select id from public.suppliers where supplier_code = 'HVB'), (select id from public.quotations where title = 'Legacy quote'), 'HVB-55012', 12400.00, 'USD');
select t.expect_error($q$insert into public.supplier_quotes (supplier_id, supplier_quote_number) values ((select id from public.suppliers where supplier_code='HVB'), 'HVB-55012')$q$, 'supplier_quote_number_unique');

-- Documents: supplier-quote files are forced into restricted storage
select t.expect_error($q$insert into public.documents (storage_path, file_name, supplier_quote_id)
  values ('general/x.pdf', 'x.pdf', (select id from public.supplier_quotes where supplier_quote_number='HVB-55012'))$q$, 'restricted/');
insert into public.documents (storage_path, file_name, supplier_quote_id, category)
  values ('restricted/sq/HVB-55012.pdf', 'HVB-55012.pdf', (select id from public.supplier_quotes where supplier_quote_number='HVB-55012'), 'supplier_quote');
insert into public.documents (storage_path, file_name, quotation_id, category)
  values ('general/q/rfq.pdf', 'rfq.pdf', (select id from public.quotations where title = 'Legacy quote'), 'customer_rfq');
select t.expect_error($q$insert into public.documents (storage_path, file_name) values ('general/orphan.pdf', 'orphan.pdf')$q$, 'documents_linked');

reset role;
insert into storage.objects (bucket_id, name) values ('documents', 'restricted/sq/HVB-55012.pdf'), ('documents', 'general/q/rfq.pdf');
set role authenticated;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);  -- employee
do $$ begin
  assert (select count(*) from public.supplier_quotes) = 0, 'employee cannot see supplier quotes';
  assert (select count(*) from public.documents) = 1, 'employee sees only the general document';
  assert (select count(*) from storage.objects) = 1, 'employee can read only the general file in storage';
end $$;
select t.expect_error($q$insert into storage.objects (bucket_id, name) values ('documents', 'restricted/sq/sneaky.pdf')$q$, 'row-level security');
select t.expect_error($q$insert into public.documents (storage_path, file_name, quotation_id, category) values ('restricted/x.pdf','x.pdf',(select id from public.quotations where title='Legacy quote'),'supplier_quote')$q$, 'row-level security');

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);  -- sales rep
do $$ begin
  assert (select count(*) from public.supplier_quotes) = 1, 'sales rep sees supplier quotes';
  assert (select count(*) from public.documents) = 2, 'sales rep sees both documents';
  assert (select count(*) from storage.objects) = 2, 'sales rep reads both files';
end $$;
delete from public.documents;  -- RLS: sales rep may not delete, so nothing is removed
do $$ begin assert (select count(*) from public.documents) = 2, 'documents preserved'; end $$;
reset role;
\echo 'supplier quote and document tests passed'
