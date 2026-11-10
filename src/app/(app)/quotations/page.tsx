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
import { DocRef } from "@/components/doc-ref";
import { formatDate, formatMoney, formatRevision } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.quotes.title };
}

const STATUSES = ["draft", "under_review", "approved", "sent", "customer_reviewing", "accepted", "converted", "rejected", "expired", "cancelled"];

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requireInternalUser();
  const { t } = await getT();
  const Q = t.quotes;
  const { q = "", status = "" } = await searchParams;
  const supabase = await createClient();
  const term = q.trim().replace(/[%,()]/g, " ");

  let query = supabase
    .from("quotations")
    .select("id, quote_number, title, status, currency, created_at, customer_reference, customers(display_name), quotation_revisions!quotations_current_revision_fk(revision_no, subtotal)")
    .order("created_at", { ascending: false });
  if (term) query = query.or(`quote_number.ilike.%${term}%,title.ilike.%${term}%,customer_reference.ilike.%${term}%`);
  if (STATUSES.includes(status)) query = query.eq("status", status);
  const { data, error } = await query.limit(200);

  return (
    <>
      <PageHeader
        title={Q.title}
        description={Q.description}
        actions={
          can(user.role, "quotes.create") ? (
            <Link href="/quotations/new" className={buttonVariants()}>
              <Plus /> {Q.newQuotation}
            </Link>
          ) : null
        }
      />
      <Panel>
        <form className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3" role="search">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder={Q.searchPlaceholder} className="pl-9" aria-label={Q.searchAria} />
          </div>
          <Select name="status" defaultValue={status} className="w-44" aria-label={t.customers.filterAria}>
            <option value="">{t.common.allStatuses}</option>
            {STATUSES.map((s) => (
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
          <p className="px-5 py-4 text-sm text-danger">{t.errors.loadFailed(Q.title, error.message)}</p>
        ) : data && data.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.customers.number}</Th>
                <Th>{t.common.customer}</Th>
                <Th>{t.common.subject}</Th>
                <Th>{t.common.status}</Th>
                <Th className="text-right">{t.common.value}</Th>
                <Th className="text-right">{t.common.created}</Th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const rev = row.quotation_revisions as unknown as { revision_no: number; subtotal: number } | null;
                return (
                  <Tr key={row.id}>
                    <Td>
                      <Link href={`/quotations/${row.id}`} className="hover:underline">
                        <DocRef value={row.quote_number} size="sm" />
                      </Link>
                      {rev ? <span className="ml-2 text-xs text-muted">{formatRevision(rev.revision_no)}</span> : null}
                    </Td>
                    <Td>{(row.customers as unknown as { display_name: string } | null)?.display_name}</Td>
                    <Td className="max-w-[28ch] truncate">{row.title}</Td>
                    <Td>
                      <StatusBadge status={row.status} />
                    </Td>
                    <Td className="text-right tabular-nums">{rev ? formatMoney(rev.subtotal, row.currency, t.localeTag) : "—"}</Td>
                    <Td className="text-right text-muted">{formatDate(row.created_at, t.localeTag)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={q || status ? Q.noMatch : Q.empty}>
            {q || status ? Q.noMatchBody : Q.emptyBody}
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
