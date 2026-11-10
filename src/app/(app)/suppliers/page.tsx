import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EmptyState, PageHeader, Panel } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const user = await requireInternalUser();
  const { q = "", kind = "" } = await searchParams;
  const supabase = await createClient();
  const term = q.trim().replace(/[%,()]/g, " ");

  // Match on name/code, or on any product, service, brand or certification they offer.
  let capabilityIds: string[] = [];
  if (term) {
    let cap = supabase.from("supplier_capabilities").select("supplier_id").ilike("value", `%${term}%`);
    if (["product", "service", "brand", "certification"].includes(kind)) cap = cap.eq("kind", kind);
    const { data } = await cap.limit(500);
    capabilityIds = [...new Set((data ?? []).map((r) => r.supplier_id as string))];
  }

  let query = supabase
    .from("suppliers")
    .select("id, supplier_code, display_name, legal_name, status, city, state, country, supplier_capabilities(kind, value)")
    .order("display_name");
  if (term) {
    const filters = kind ? [] : [`display_name.ilike.%${term}%`, `legal_name.ilike.%${term}%`, `supplier_code.ilike.%${term}%`];
    if (capabilityIds.length) filters.push(`id.in.(${capabilityIds.join(",")})`);
    query = filters.length ? query.or(filters.join(",")) : query.eq("id", "00000000-0000-0000-0000-000000000000");
  }
  const { data: suppliers, error } = await query.limit(200);

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Manufacturers, distributors and service providers ANASA buys from. Search by name or by what they supply."
        actions={
          can(user.role, "suppliers.write") ? (
            <Link href="/suppliers/new" className={buttonVariants()}>
              <Plus /> New supplier
            </Link>
          ) : null
        }
      />
      <Panel>
        <form className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3" role="search">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Name, code, product, service or brand" className="pl-9" aria-label="Search suppliers" />
          </div>
          <Select name="kind" defaultValue={kind} className="w-44" aria-label="Search within">
            <option value="">Anything</option>
            <option value="product">Products</option>
            <option value="service">Services</option>
            <option value="brand">Brands</option>
            <option value="certification">Certifications</option>
          </Select>
          <button type="submit" className={buttonVariants({ variant: "secondary" })}>
            Search
          </button>
        </form>
        {error ? (
          <p className="px-5 py-4 text-sm text-danger">Suppliers could not be loaded: {error.message}</p>
        ) : suppliers && suppliers.length ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-24">Code</Th>
                <Th>Supplier</Th>
                <Th>Supplies</Th>
                <Th>Location</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => {
                const caps = (s.supplier_capabilities as { kind: string; value: string }[]) ?? [];
                return (
                  <Tr key={s.id}>
                    <Td className="font-semibold tracking-wider">{s.supplier_code}</Td>
                    <Td>
                      <Link href={`/suppliers/${s.id}`} className="font-medium hover:underline">
                        {s.display_name}
                      </Link>
                    </Td>
                    <Td>
                      <div className="flex max-w-md flex-wrap gap-1">
                        {caps.slice(0, 4).map((c) => (
                          <Badge key={`${c.kind}-${c.value}`}>{c.value}</Badge>
                        ))}
                        {caps.length > 4 ? <span className="text-xs text-muted">+{caps.length - 4}</span> : null}
                        {caps.length === 0 ? <span className="text-muted">—</span> : null}
                      </div>
                    </Td>
                    <Td className="text-muted">{[s.city, s.state, s.country].filter(Boolean).join(", ") || "—"}</Td>
                    <Td>
                      <StatusBadge status={s.status} />
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={q ? "No suppliers match this search" : "No suppliers yet"}>
            {q ? "Try a brand or part family instead of a part number." : "Add the suppliers you request pricing from."}
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
