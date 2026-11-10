import Link from "next/link";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, Panel, PanelHeader, EmptyState } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { DocRef } from "@/components/doc-ref";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Executive dashboard" };

const PIPELINE = [
  { status: "draft", label: "Draft", color: "var(--line-strong)" },
  { status: "under_review", label: "Under review", color: "var(--warn)" },
  { status: "approved", label: "Approved", color: "color-mix(in srgb, var(--accent) 55%, transparent)" },
  { status: "sent", label: "Sent", color: "var(--accent)" },
  { status: "customer_reviewing", label: "Customer reviewing", color: "var(--accent)" },
  { status: "accepted", label: "Accepted", color: "color-mix(in srgb, var(--ok) 60%, transparent)" },
  { status: "converted", label: "Converted to order", color: "var(--ok)" },
] as const;

export default async function DashboardPage() {
  const user = await requireInternalUser();
  const supabase = await createClient();

  const [customers, suppliers, orders, quoteStatuses, recent] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("sales_orders").select("id", { count: "exact", head: true }),
    supabase.from("quotations").select("status"),
    supabase
      .from("quotations")
      .select("id, quote_number, title, status, created_at, customers(display_name)")
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const counts = new Map<string, number>();
  for (const q of quoteStatuses.data ?? []) counts.set(q.status, (counts.get(q.status) ?? 0) + 1);
  const pipelineTotal = PIPELINE.reduce((s, p) => s + (counts.get(p.status) ?? 0), 0);

  // Conversion rate counts only quotations that reached the customer and were decided.
  const decided = ["converted", "rejected", "expired"].reduce((s, k) => s + (counts.get(k) ?? 0), 0);
  const conversion = decided > 0 ? Math.round(((counts.get("converted") ?? 0) / decided) * 100) : null;

  return (
    <>
      <PageHeader
        title={`Good to see you${user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}`}
        description="Live figures from Command Center records. Modules still on the roadmap add their figures here as they ship."
        actions={
          can(user.role, "quotes.create") ? (
            <Link href="/quotations/new" className={buttonVariants()}>
              <Plus /> New quotation
            </Link>
          ) : null
        }
      />

      <div className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Active customers" value={customers.count ?? 0} href="/customers" />
        <Metric label="Active suppliers" value={suppliers.count ?? 0} href="/suppliers" />
        <Metric label="Sales orders" value={orders.count ?? 0} />
        <Metric
          label="Quote-to-order conversion"
          value={conversion === null ? "—" : `${conversion}%`}
          hint={conversion === null ? "Shown once quotations are converted, rejected or expire" : `${decided} decided quotations`}
        />
      </div>

      <Panel className="mt-6">
        <PanelHeader title="Quotation pipeline" description={`${pipelineTotal} open or converted quotations`} />
        <div className="px-5 py-5">
          {pipelineTotal === 0 ? (
            <p className="text-sm text-muted">No quotations yet. Create one to start the pipeline.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label="Quotations by status">
                {PIPELINE.map((p) => {
                  const n = counts.get(p.status) ?? 0;
                  return n ? <span key={p.status} style={{ width: `${(n / pipelineTotal) * 100}%`, background: p.color }} /> : null;
                })}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
                {PIPELINE.map((p) => (
                  <div key={p.status} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                    <dt className="truncate text-muted">{p.label}</dt>
                    <dd className="ml-auto font-medium tabular-nums">{counts.get(p.status) ?? 0}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader
          title="Latest quotations"
          actions={
            <Link href="/quotations" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              View all
            </Link>
          }
        />
        {recent.data && recent.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>Quotation</Th>
                <Th>Customer</Th>
                <Th>Subject</Th>
                <Th>Status</Th>
                <Th className="text-right">Created</Th>
              </tr>
            </thead>
            <tbody>
              {recent.data.map((q) => (
                <Tr key={q.id}>
                  <Td>
                    <Link href={`/quotations/${q.id}`} className="hover:underline">
                      <DocRef value={q.quote_number} size="sm" />
                    </Link>
                  </Td>
                  <Td>{(q.customers as unknown as { display_name: string } | null)?.display_name}</Td>
                  <Td className="max-w-[28ch] truncate">{q.title}</Td>
                  <Td>
                    <StatusBadge status={q.status} />
                  </Td>
                  <Td className="text-right text-muted">{formatDate(q.created_at)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title="No quotations yet">Quotations you create appear here with their ANASA number.</EmptyState>
        )}
      </Panel>
    </>
  );
}

function Metric({ label, value, hint, href }: { label: string; value: number | string; hint?: string; href?: string }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link href={href} className="bg-surface px-5 py-5 transition-colors hover:bg-surface-2">
      {body}
    </Link>
  ) : (
    <div className="bg-surface px-5 py-5">{body}</div>
  );
}
