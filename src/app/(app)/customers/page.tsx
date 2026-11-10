import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EmptyState, PageHeader, Panel } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Customers" };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireInternalUser();
  const { q = "", status = "" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("customers")
    .select("id, customer_code, legal_name, display_name, status, billing_city, billing_state, currency, customer_contacts(first_name, last_name, is_primary)")
    .order("display_name");
  const term = q.trim().replace(/[%,()]/g, " ");
  if (term) query = query.or(`legal_name.ilike.%${term}%,display_name.ilike.%${term}%,customer_code.ilike.%${term}%`);
  if (["prospect", "active", "on_hold", "inactive"].includes(status)) query = query.eq("status", status);
  const { data: customers, error } = await query.limit(200);

  return (
    <>
      <PageHeader
        title="Customers"
        description="Every company ANASA quotes for. The code in the first column appears in all of that company’s quotation and order numbers."
        actions={
          can(user.role, "customers.write") ? (
            <Link href="/customers/new" className={buttonVariants()}>
              <Plus /> New customer
            </Link>
          ) : null
        }
      />

      <Panel>
        <form className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3" role="search">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Search by name or code" className="pl-9" aria-label="Search customers" />
          </div>
          <Select name="status" defaultValue={status} className="w-40" aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="on_hold">On hold</option>
            <option value="inactive">Inactive</option>
          </Select>
          <button type="submit" className={buttonVariants({ variant: "secondary" })}>
            Search
          </button>
        </form>

        {error ? (
          <p className="px-5 py-4 text-sm text-danger">Customers could not be loaded: {error.message}</p>
        ) : customers && customers.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-24">Code</Th>
                <Th>Company</Th>
                <Th>Primary contact</Th>
                <Th>Location</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const primary = (c.customer_contacts as { first_name: string; last_name: string | null; is_primary: boolean }[]).find((x) => x.is_primary);
                return (
                  <Tr key={c.id}>
                    <Td className="font-semibold tracking-wider">{c.customer_code}</Td>
                    <Td>
                      <Link href={`/customers/${c.id}`} className="font-medium hover:underline">
                        {c.display_name}
                      </Link>
                      {c.legal_name !== c.display_name ? <p className="text-xs text-muted">{c.legal_name}</p> : null}
                    </Td>
                    <Td className="text-muted">{primary ? `${primary.first_name} ${primary.last_name ?? ""}` : "—"}</Td>
                    <Td className="text-muted">{[c.billing_city, c.billing_state].filter(Boolean).join(", ") || "—"}</Td>
                    <Td>
                      <StatusBadge status={c.status} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={q || status ? "No customers match this search" : "No customers yet"}>
            {q || status ? "Try a shorter name or clear the status filter." : "Add your first customer to start issuing quotations."}
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
