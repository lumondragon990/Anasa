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
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.customers.title };
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireInternalUser();
  const { t } = await getT();
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
        title={t.customers.title}
        description={t.customers.description}
        actions={
          can(user.role, "customers.write") ? (
            <Link href="/customers/new" className={buttonVariants()}>
              <Plus /> {t.customers.newCustomer}
            </Link>
          ) : null
        }
      />

      <Panel>
        <form className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3" role="search">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder={t.customers.searchPlaceholder} className="pl-9" aria-label={t.customers.searchAria} />
          </div>
          <Select name="status" defaultValue={status} className="w-40" aria-label={t.customers.filterAria}>
            <option value="">{t.common.allStatuses}</option>
            {["active", "prospect", "on_hold", "inactive"].map((s) => (
              <option key={s} value={s}>
                {t.status[s]}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonVariants({ variant: "secondary" })}>
            {t.common.search}
          </button>
        </form>

        {error ? (
          <p className="px-5 py-4 text-sm text-danger">{t.errors.loadFailed(t.customers.title, error.message)}</p>
        ) : customers && customers.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th className="w-24">{t.common.code}</Th>
                <Th>{t.common.company}</Th>
                <Th>{t.common.primaryContact}</Th>
                <Th>{t.common.location}</Th>
                <Th>{t.common.status}</Th>
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
          <EmptyState title={q || status ? t.customers.noMatch : t.customers.empty}>
            {q || status ? t.customers.noMatchBody : t.customers.emptyBody}
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
