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

export const metadata = { title: "Quotations" };

const STATUSES = ["draft", "under_review", "approved", "sent", "customer_reviewing", "accepted", "converted", "rejected", "expired", "cancelled"];

export default async function QuotationsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const user = await requireInternalUser();
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
        title="Quotations"
        description="ANASA customer quotations. Numbers are assigned by the database when a draft is created and are never reused."
        actions={
          can(user.role, "quotes.create") ? (
            <Link href="/quotations/new" className={buttonVariants()}>
              <Plus /> New quotation
            </Link>
          ) : null
        }
      />
      <Panel>
        <form className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3" role="search">
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input name="q" defaultValue={q} placeholder="Quote number, subject or customer reference" className="pl-9" aria-label="Search quotations" />
          </div>
          <Select name="status" defaultValue={status} className="w-44" aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
          <button type="submit" className={buttonVariants({ variant: "secondary" })}>
            Search
          </button>
        </form>
        {error ? (
          <p className="px-5 py-4 text-sm text-danger">Quotations could not be loaded: {error.message}</p>
        ) : data && data.length ? (
          <Table>
            <thead>
              <tr>
                <Th>Number</Th>
                <Th>Customer</Th>
                <Th>Subject</Th>
                <Th>Status</Th>
                <Th className="text-right">Value</Th>
                <Th className="text-right">Created</Th>
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
                    <Td className="text-right tabular-nums">{rev ? formatMoney(rev.subtotal, row.currency) : "—"}</Td>
                    <Td className="text-right text-muted">{formatDate(row.created_at)}</Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={q || status ? "No quotations match this search" : "No quotations yet"}>
            {q || status ? "Search accepts part of a number, e.g. ABC-Q-2026." : "Create a quotation from a customer’s page or with New quotation."}
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
