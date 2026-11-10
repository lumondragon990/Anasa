-- ============================================================================
-- ANASA COMMAND CENTER — Migration 0003: Row Level Security & grants
--
-- Principles
--   * RLS is enabled on every table. No table is readable by 'anon'.
--   * Internal staff (any role except pending / portal roles) can read
--     master data and commercial records.
--   * Writes are role-scoped. Numbered documents are only created through
--     SECURITY DEFINER functions, never by direct INSERT.
--   * Supplier cost data (quotation_line_costs) is visible only to roles
--     returned by can_view_costs().
--   * Portal roles get no access in Phase 1; Phase 11 adds scoped policies.
-- ============================================================================

-- Enable RLS everywhere
alter table public.profiles                 enable row level security;
alter table public.application_settings     enable row level security;
alter table public.customers                enable row level security;
alter table public.customer_code_registry   enable row level security;
alter table public.customer_code_history    enable row level security;
alter table public.customer_contacts        enable row level security;
alter table public.customer_locations       enable row level security;
alter table public.suppliers                enable row level security;
alter table public.supplier_contacts        enable row level security;
alter table public.supplier_capabilities    enable row level security;
alter table public.audit_logs               enable row level security;
alter table public.quotation_counters       enable row level security;
alter table public.sales_order_counters     enable row level security;
alter table public.document_counters        enable row level security;
alter table public.quotations               enable row level security;
alter table public.quotation_revisions      enable row level security;
alter table public.quotation_line_items     enable row level security;
alter table public.quotation_line_costs     enable row level security;
alter table public.customer_purchase_orders enable row level security;
alter table public.sales_orders             enable row level security;
alter table public.sales_order_lines        enable row level security;

-- Remove Supabase's default broad grants and re-grant deliberately.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all functions in schema public from anon, public;

grant usage on schema public to authenticated;

-- ---------------------------------------------------------------------------
-- Role groups (as SQL arrays, used in policies)
-- ---------------------------------------------------------------------------
-- crm_writers:   may create/edit customers & contacts
-- proc_writers:  may create/edit suppliers & capabilities
-- quote_writers: may edit draft quotation content

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

create policy profiles_select_self_or_internal on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_internal());

create policy profiles_update_self_name on public.profiles
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- application_settings: internal read, super_admin write
-- ---------------------------------------------------------------------------
grant select, update on public.application_settings to authenticated;
create policy settings_select on public.application_settings
  for select to authenticated using (public.is_internal());
create policy settings_update on public.application_settings
  for update to authenticated
  using (public.has_role(array['super_admin']::public.app_role[]))
  with check (public.has_role(array['super_admin']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- customers (+ contacts, locations)
-- customer_code is deliberately NOT in the UPDATE grant: changes go only
-- through change_customer_code(), which enforces role, reason and logging.
-- ---------------------------------------------------------------------------
grant select, insert, delete on public.customers to authenticated;
grant update (legal_name, display_name, status, website, email, phone, tax_id, payment_terms, currency,
              account_manager_id, billing_line1, billing_line2, billing_city, billing_state,
              billing_postal_code, billing_country, notes)
  on public.customers to authenticated;

create policy customers_select on public.customers
  for select to authenticated using (public.is_internal());
create policy customers_insert on public.customers
  for insert to authenticated
  with check (public.has_role(array['super_admin','director','operations_manager','sales_rep']::public.app_role[]));
create policy customers_update on public.customers
  for update to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','sales_rep']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','sales_rep']::public.app_role[]));
create policy customers_delete on public.customers
  for delete to authenticated
  using (public.has_role(array['super_admin']::public.app_role[]));

grant select on public.customer_code_registry, public.customer_code_history to authenticated;
create policy code_registry_select on public.customer_code_registry
  for select to authenticated using (public.is_internal());
create policy code_history_select on public.customer_code_history
  for select to authenticated using (public.is_internal());

grant select, insert, update, delete on public.customer_contacts, public.customer_locations to authenticated;
create policy customer_contacts_select on public.customer_contacts
  for select to authenticated using (public.is_internal());
create policy customer_contacts_write on public.customer_contacts
  for all to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','sales_rep','service_coordinator']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','sales_rep','service_coordinator']::public.app_role[]));
create policy customer_locations_select on public.customer_locations
  for select to authenticated using (public.is_internal());
create policy customer_locations_write on public.customer_locations
  for all to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','sales_rep','service_coordinator']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','sales_rep','service_coordinator']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- suppliers (+ contacts, capabilities)
-- ---------------------------------------------------------------------------
grant select, insert, update, delete on public.suppliers, public.supplier_contacts, public.supplier_capabilities to authenticated;

create policy suppliers_select on public.suppliers
  for select to authenticated using (public.is_internal());
create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (public.has_role(array['super_admin','director','operations_manager','procurement_manager']::public.app_role[]));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','procurement_manager']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','procurement_manager']::public.app_role[]));
create policy suppliers_delete on public.suppliers
  for delete to authenticated using (public.has_role(array['super_admin']::public.app_role[]));

create policy supplier_contacts_select on public.supplier_contacts
  for select to authenticated using (public.is_internal());
create policy supplier_contacts_write on public.supplier_contacts
  for all to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','procurement_manager']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','procurement_manager']::public.app_role[]));
create policy supplier_capabilities_select on public.supplier_capabilities
  for select to authenticated using (public.is_internal());
create policy supplier_capabilities_write on public.supplier_capabilities
  for all to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','procurement_manager']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','procurement_manager']::public.app_role[]));

-- ---------------------------------------------------------------------------
-- audit_logs: read-only for super_admin and director; nobody writes directly
-- ---------------------------------------------------------------------------
grant select on public.audit_logs to authenticated;
create policy audit_select on public.audit_logs
  for select to authenticated using (public.has_role(array['super_admin','director']::public.app_role[]));

-- Counters: no grants, no policies. Only SECURITY DEFINER functions touch them.

-- ---------------------------------------------------------------------------
-- Quotations
-- Direct INSERT is not granted: create_quotation() is the only way in.
-- ---------------------------------------------------------------------------
grant select on public.quotations to authenticated;
grant update (title, customer_reference, valid_until, customer_contact_id, owner_id) on public.quotations to authenticated;

create policy quotations_select on public.quotations
  for select to authenticated using (public.is_internal());
create policy quotations_update on public.quotations
  for update to authenticated
  using (status in ('draft','under_review')
         and public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]));

grant select on public.quotation_revisions to authenticated;
grant update (reason, scope_summary, delivery_terms, payment_terms, commercial_terms, exclusions)
  on public.quotation_revisions to authenticated;
create policy quotation_revisions_select on public.quotation_revisions
  for select to authenticated using (public.is_internal());
create policy quotation_revisions_update on public.quotation_revisions
  for update to authenticated
  using (not is_locked and public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]))
  with check (not is_locked);

grant select, insert, update, delete on public.quotation_line_items to authenticated;
create policy quotation_lines_select on public.quotation_line_items
  for select to authenticated using (public.is_internal());
create policy quotation_lines_write on public.quotation_line_items
  for all to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]))
  with check (public.has_role(array['super_admin','director','operations_manager','sales_rep','procurement_manager']::public.app_role[]));

grant select, insert, update, delete on public.quotation_line_costs to authenticated;
create policy quotation_costs_select on public.quotation_line_costs
  for select to authenticated using (public.can_view_costs());
create policy quotation_costs_write on public.quotation_line_costs
  for all to authenticated
  using (public.can_view_costs()) with check (public.can_view_costs());

-- ---------------------------------------------------------------------------
-- Customer POs & sales orders
-- ---------------------------------------------------------------------------
grant select, insert on public.customer_purchase_orders to authenticated;
grant update (po_date, total_amount, notes) on public.customer_purchase_orders to authenticated;
create policy customer_pos_select on public.customer_purchase_orders
  for select to authenticated using (public.is_internal());
create policy customer_pos_insert on public.customer_purchase_orders
  for insert to authenticated
  with check (public.has_role(array['super_admin','director','operations_manager','sales_rep']::public.app_role[]));
create policy customer_pos_update on public.customer_purchase_orders
  for update to authenticated
  using (public.has_role(array['super_admin','director','operations_manager','sales_rep']::public.app_role[]));

grant select on public.sales_orders, public.sales_order_lines to authenticated;
create policy sales_orders_select on public.sales_orders
  for select to authenticated using (public.is_internal());
create policy sales_order_lines_select on public.sales_order_lines
  for select to authenticated using (public.is_internal());

-- ---------------------------------------------------------------------------
-- Function execute grants (authenticated only; each function checks role)
-- ---------------------------------------------------------------------------
grant execute on function public.current_app_role()                          to authenticated;
grant execute on function public.has_role(public.app_role[])                 to authenticated;
grant execute on function public.is_internal()                               to authenticated;
grant execute on function public.can_view_costs()                            to authenticated;
grant execute on function public.business_year(timestamptz)                  to authenticated;
grant execute on function public.customer_code_available(text)               to authenticated;
grant execute on function public.change_customer_code(uuid, text, text)      to authenticated;
grant execute on function public.set_user_role(uuid, public.app_role, boolean) to authenticated;
grant execute on function public.create_quotation(uuid, text, text, text, date, uuid) to authenticated;
grant execute on function public.approve_quotation_revision(uuid, text)      to authenticated;
grant execute on function public.create_quotation_revision(uuid, text)       to authenticated;
grant execute on function public.accept_quotation(uuid, uuid)                to authenticated;
grant execute on function public.convert_quotation_to_order(uuid, uuid, text, boolean) to authenticated;

-- Internal helpers stay private.
revoke execute on function public.next_quotation_sequence(uuid, int)   from authenticated;
revoke execute on function public.next_sales_order_sequence(uuid, int) from authenticated;
revoke execute on function public.next_document_number(text)           from authenticated;
revoke execute on function public.get_setting(text)                    from authenticated;
