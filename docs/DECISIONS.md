# Business rules decided in Phase 1

These answer questions the master spec left open. Change them deliberately: several are enforced in the database.

| Topic | Decision | Where enforced |
|---|---|---|
| When a quote number is assigned | When the draft is created. A cancelled or abandoned quote keeps its number. Numbers are never reused, so **gaps are possible and expected**. | `create_quotation()` |
| Sequence key | Customer **UUID** + year, not the readable code. A code change continues the same sequence. | `quotation_counters`, `sales_order_counters` |
| Which year | Year of creation in the business timezone (`application_settings.business_timezone`, default `America/Chicago`). | `business_year()` |
| Sequence width | 4 digits for customer documents (Q, P), 5 for global documents (REQ, SRFQ, SPO, SVC). Numbers roll past 9999 without breaking the format check. | migration 0002 |
| Customer code format | 2–6 uppercase letters or digits. Unique. Every code ever issued is reserved for its company forever (`customer_code_registry`). | migration 0001 |
| Changing a customer code | Super Administrator or Director only, with a reason, logged in `customer_code_history`. Issued documents keep their original number; new documents use the new code. | `change_customer_code()` |
| Supplier code format | 2–8 uppercase letters or digits, unique. | migration 0001 |
| Customer PO uniqueness | Unique **per customer**, not globally. | `customer_po_unique_per_customer` |
| Self-approval | Allowed by default so a small team isn't blocked. Turn off under Administration → Settings. | `approve_quotation_revision()` |
| Who approves quotations | Super Administrator, Director, Operations Manager. | `approve_quotation_revision()` |
| Who converts to orders | Super Administrator, Director, Operations Manager. | `convert_quotation_to_order()` |
| Revisions | Rev 00 is created with the quote. A new revision is allowed only once the current one is approved. It copies lines and costs. The previous revision becomes `superseded` and stays immutable. | `create_quotation_revision()`, `guard_locked_revision` |
| Revising after conversion | Blocked. Use a change order on the sales order (Phase 6/7). | `create_quotation_revision()` |
| One order per quotation | Enforced by a unique constraint (also the double-click guard). Partial/multiple awards are a later, explicit workflow. | `sales_orders_one_per_quotation` |
| Order type | Derived from line types: product, service, or mixed. | `convert_quotation_to_order()` |
| PO mismatch | Caller flags it; the order is created in `po_mismatch_review`, which later phases treat as "no supplier purchasing". The comparison screen arrives in Phase 6. | `convert_quotation_to_order()` |
| Money | `NUMERIC` in Postgres; `decimal.js` in TypeScript; numbers pass between them as strings. | `lib/money.ts` |
| Supplier costs | Separate table with its own RLS policy; never selected by customer-facing code. | `quotation_line_costs` |
| First administrator | The first account to sign up becomes Super Administrator; later sign-ups are `pending`. | `handle_new_user()` |
| Customer deletion | Not possible once created (codes are reserved). Set status to Inactive. | FK `customer_code_registry → customers` |
