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
import { formatDate, formatMoney, formatTotalsByCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.dashboard.title };
}

const PIPELINE = [
  { status: "draft", color: "var(--line-strong)" },
  { status: "under_review", color: "var(--warn)" },
  { status: "approved", color: "color-mix(in srgb, var(--accent) 55%, transparent)" },
  { status: "sent", color: "var(--accent)" },
  { status: "customer_reviewing", color: "var(--accent)" },
  { status: "accepted", color: "color-mix(in srgb, var(--ok) 60%, transparent)" },
  { status: "converted", color: "var(--ok)" },
] as const;

export default async function DashboardPage() {
  const user = await requireInternalUser();
  const { t } = await getT();
  const label = (s: string) => (s === "converted" ? t.dashboard.convertedToOrder : t.status[s]);
  const supabase = await createClient();

  const [customers, suppliers, orders, quoteStatuses, recent, recentOrders] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("suppliers").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("sales_orders").select("status, payment_status, total_amount, amount_paid, currency").neq("status", "cancelled"),
    supabase.from("quotations").select("status"),
    supabase
      .from("quotations")
      .select("id, quote_number, title, status, created_at, customers(display_name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("sales_orders")
      .select("id, order_number, status, payment_status, total_amount, amount_paid, currency, converted_at, customers(display_name)")
      .neq("status", "cancelled")
      .order("converted_at", { ascending: false })
      .limit(6),
  ]);

  // Approved for sale = customer PO received; split by whether it has been paid.
  const orderRows = orders.data ?? [];
  const awaiting = orderRows.filter((o) => o.payment_status !== "paid");
  const paidRows = orderRows.filter((o) => o.payment_status === "paid");

  const counts = new Map<string, number>();
  for (const q of quoteStatuses.data ?? []) counts.set(q.status, (counts.get(q.status) ?? 0) + 1);
  const pipelineTotal = PIPELINE.reduce((s, p) => s + (counts.get(p.status) ?? 0), 0);

  // Conversion rate counts only quotations that reached the customer and were decided.
  const decided = ["converted", "rejected", "expired"].reduce((s, k) => s + (counts.get(k) ?? 0), 0);
  const conversion = decided > 0 ? Math.round(((counts.get("converted") ?? 0) / decided) * 100) : null;

  return (
    <>
      <PageHeader
        title={t.dashboard.greeting(user.fullName ? user.fullName.split(" ")[0] : null)}
        description={t.dashboard.description}
        actions={
          can(user.role, "quotes.create") ? (
            <Link href="/quotations/new" className={buttonVariants()}>
              <Plus /> {t.dashboard.newQuotation}
            </Link>
          ) : null
        }
      />

      <div className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-2 lg:grid-cols-5">
        <Metric label={t.dashboard.activeCustomers} value={customers.count ?? 0} href="/customers" />
        <Metric label={t.dashboard.activeSuppliers} value={suppliers.count ?? 0} href="/suppliers" />
        <Metric
          label={t.dashboard.approvedForSale}
          value={awaiting.length ? formatTotalsByCurrency(awaiting.map((o) => ({ currency: o.currency, amount: Number(o.total_amount) - Number(o.amount_paid) })), t.localeTag) : t.dashboard.nothingYet}
          hint={t.dashboard.approvedHint(awaiting.length)}
          href="/sales-orders?view=approved"
          small
        />
        <Metric
          label={t.dashboard.paidTitle}
          value={paidRows.length ? formatTotalsByCurrency(paidRows.map((o) => ({ currency: o.currency, amount: o.total_amount })), t.localeTag) : t.dashboard.nothingYet}
          hint={t.dashboard.paidHint(paidRows.length)}
          href="/sales-orders?view=paid"
          small
          tone="ok"
        />
        <Metric
          label={t.dashboard.conversion}
          value={conversion === null ? "—" : `${conversion}%`}
          hint={conversion === null ? t.dashboard.conversionEmpty : t.dashboard.conversionHint(decided)}
        />
      </div>

      <Panel className="mt-6">
        <PanelHeader title={t.dashboard.pipeline} description={t.dashboard.pipelineCount(pipelineTotal)} />
        <div className="px-5 py-5">
          {pipelineTotal === 0 ? (
            <p className="text-sm text-muted">{t.dashboard.pipelineEmpty}</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-2" role="img" aria-label={t.dashboard.pipelineAria}>
                {PIPELINE.map((p) => {
                  const n = counts.get(p.status) ?? 0;
                  return n ? <span key={p.status} style={{ width: `${(n / pipelineTotal) * 100}%`, background: p.color }} /> : null;
                })}
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:grid-cols-7">
                {PIPELINE.map((p) => (
                  <div key={p.status} className="flex items-center gap-2">
                    <span className="size-2 shrink-0 rounded-full" style={{ background: p.color }} aria-hidden />
                    <dt className="truncate text-muted">{label(p.status)}</dt>
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
          title={t.orders.recentOrders}
          actions={
            <Link href="/sales-orders" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {t.common.viewAll}
            </Link>
          }
        />
        {recentOrders.data && recentOrders.data.length ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.orders.order}</Th>
                <Th>{t.common.customer}</Th>
                <Th>{t.common.status}</Th>
                <Th className="text-right">{t.orders.total}</Th>
                <Th className="text-right">{t.orders.balance}</Th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.data.map((o) => (
                <Tr key={o.id}>
                  <Td>
                    <Link href={`/sales-orders/${o.id}`} className="hover:underline">
                      <DocRef value={o.order_number} size="sm" />
                    </Link>
                  </Td>
                  <Td>{(o.customers as unknown as { display_name: string } | null)?.display_name}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {o.status === "po_mismatch_review" ? <StatusBadge status={o.status} /> : null}
                      <StatusBadge status={o.payment_status} />
                    </div>
                  </Td>
                  <Td className="text-right tabular-nums">{formatMoney(o.total_amount, o.currency, t.localeTag)}</Td>
                  <Td className="text-right tabular-nums">{formatMoney((Number(o.total_amount) - Number(o.amount_paid)).toFixed(2), o.currency, t.localeTag)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={t.orders.empty}>{t.orders.emptyBody}</EmptyState>
        )}
      </Panel>

      <Panel className="mt-6">
        <PanelHeader
          title={t.dashboard.latest}
          actions={
            <Link href="/quotations" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              {t.common.viewAll}
            </Link>
          }
        />
        {recent.data && recent.data.length > 0 ? (
          <Table>
            <thead>
              <tr>
                <Th>{t.dashboard.quotation}</Th>
                <Th>{t.common.customer}</Th>
                <Th>{t.common.subject}</Th>
                <Th>{t.common.status}</Th>
                <Th className="text-right">{t.common.created}</Th>
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
                  <Td className="text-right text-muted">{formatDate(q.created_at, t.localeTag)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <EmptyState title={t.dashboard.noQuotes}>{t.dashboard.noQuotesBody}</EmptyState>
        )}
      </Panel>
    </>
  );
}

function Metric({
  label,
  value,
  hint,
  href,
  small,
  tone,
}: {
  label: string;
  value: number | string;
  hint?: string;
  href?: string;
  small?: boolean;
  tone?: "ok";
}) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("mt-2 font-semibold tabular-nums", small ? "text-xl leading-9" : "text-3xl", tone === "ok" && "text-ok")}>{value}</p>
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
