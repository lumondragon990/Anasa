/**
 * Role definitions mirrored from the database enum `public.app_role`.
 * The database (RLS + SECURITY DEFINER functions) is the source of truth;
 * these helpers only decide what the UI offers. Never rely on them alone.
 */
export const ROLES = [
  "pending",
  "super_admin",
  "director",
  "operations_manager",
  "procurement_manager",
  "sales_rep",
  "service_coordinator",
  "finance_manager",
  "employee",
  "customer_portal",
  "supplier_portal",
] as const;

export type AppRole = (typeof ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  pending: "Awaiting access",
  super_admin: "Super Administrator",
  director: "Company Director",
  operations_manager: "Operations Manager",
  procurement_manager: "Procurement Manager",
  sales_rep: "Sales Representative",
  service_coordinator: "Service Coordinator",
  finance_manager: "Finance Manager",
  employee: "General Employee",
  customer_portal: "Customer Portal User",
  supplier_portal: "Supplier Portal User",
};

const INTERNAL_EXCLUDED: AppRole[] = ["pending", "customer_portal", "supplier_portal"];

export type Capability =
  | "customers.write"
  | "customers.changeCode"
  | "suppliers.write"
  | "quotes.create"
  | "quotes.approve"
  | "orders.convert"
  | "costs.view"
  | "payments.record"
  | "payments.delete"
  | "users.manage";

const CAPABILITIES: Record<Capability, AppRole[]> = {
  "customers.write": ["super_admin", "director", "operations_manager", "sales_rep"],
  "customers.changeCode": ["super_admin", "director"],
  "suppliers.write": ["super_admin", "director", "operations_manager", "procurement_manager"],
  "quotes.create": ["super_admin", "director", "operations_manager", "sales_rep", "procurement_manager"],
  "quotes.approve": ["super_admin", "director", "operations_manager"],
  "orders.convert": ["super_admin", "director", "operations_manager"],
  "costs.view": ["super_admin", "director", "operations_manager", "procurement_manager", "sales_rep", "finance_manager"],
  "payments.record": ["super_admin", "director", "operations_manager", "finance_manager"],
  "payments.delete": ["super_admin", "director", "finance_manager"],
  "users.manage": ["super_admin"],
};

export function isInternal(role: AppRole | null | undefined) {
  return !!role && !INTERNAL_EXCLUDED.includes(role);
}

export function can(role: AppRole | null | undefined, capability: Capability) {
  return !!role && CAPABILITIES[capability].includes(role);
}
