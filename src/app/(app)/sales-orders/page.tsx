import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { EmptyState, PageHeader, Panel } from "@/components/ui/panel";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { DocRef } from "@/components/doc-ref";
import { cn, formatDate, formatMoney, formatRevision, formatTotalsByCurrency } from "@/lib/utils";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.orders.title };
}

const VIEWS = ["all", "approved", "partially_paid", "paid", "review"] as const;
type View = (typeof VIEWS)[number];

export default async function SalesOrdersPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireInternalUser();
  const { t } = await getT();
  const O = t.orders;
  const L = t.localeTag;
  const { view: rawView } = await searchParams;
  const view: View = (VIEWS as readonly string[]).includes(rawView ?? "") ? (rawView as View) : "all";
  const supabase = await createClient();

  const { data: all, error } = await supabase
    .from("sales_orders")
    .select(
      "id, order_number, status, payment_status, total_amount, amount_paid, currency, converted_at, paid_at, customers(display_name), quotations!sales_orders_source_quotation_id_fkey(quote_number, title), quotation_revisions!sales_orders_source_revision_id_fkey(revision_no), customer_purchase_orders(po_number)",
    )
    .neq("status", "cancelled")
    .order("converted_at", { ascending: false })
    .limit(500);

  const rows = all ?? [];
  const match = (r: (typeof rows)[number], v: View) =>
    v === "all" ||
    (v === "review" && r.status === "po_mismatch_review") ||
    (v === "approved" && r.status !== "po_mismatch_review" && r.payment_status === "unpaid") ||
    (v === "partially_paid" && r.payment_status === "partially_paid") ||
    (v === "paid" && r.payment_status === "paid");
  const shown = rows.filter((r) => match(r, view));
  const counts = Object.fromEntries(VIEWS.map((v) => [v, rows.filter((r) => match(r, v)).length]));

  return (
    <>
      <PageHeader title={O.title} description={O.description} />
      <nav aria-label={O.title} className="mb-4 flex flex-wrap gap-1 border-b border-line">
        {VIEWS.map((v) => (
          <Link
            key={v}
            href={v === "all" ? "/sales-orders" : `/sales-orders?view=${v}`}
            aria-current={view === v ? "page" : undefined}
            className={cn(
              "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm",
              view === v ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
            )}
          >
            {O.tabs[v]}
            <span className="rounded-full bg-surface-2 px-1.5 text-xs tabular-nums text-muted">{counts[v]}</span>
          </Link>
        ))}
      </nav>
      <Panel>
        {error ? (
          <p className="px-5 py-4 text-sm text-danger">{t.errors.loadFailed(O.title, error.message)}</p>
        ) : shown.length ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>{O.order}</Th>
                  <Th>{t.common.customer}</Th>
                  <Th>{O.quote}</Th>
                  <Th>{O.customerPo}</Th>
                  <Th>{t.common.status}</Th>
                  <Th className="text-right">{O.total}</Th>
                  <Th className="text-right">{O.balance}</Th>
                </tr>
              </thead>
              <tbody>
                {shown.map((o) => {
                  const q = o.quotations as unknown as { quote_number: string; title: string } | null;
                  const r = o.quotation_revisions as unknown as { revision_no: number } | null;
                  const po = o.customer_purchase_orders as unknown as { po_number: string } | null;
                  const balance = Number(o.total_amount) - Number(o.amount_paid);
                  return (
                    <Tr key={o.id}>
                      <Td>
                        <Link href={`/sales-orders/${o.id}`} className="hover:underline">
                          <DocRef value={o.order_number} size="sm" />
                        </Link>
                        <p className="text-xs text-muted">{formatDate(o.converted_at, L)}</p>
                      </Td>
                      <Td>{(o.customers as unknown as { display_name: string } | null)?.display_name}</Td>
                      <Td className="text-muted">
                        {q?.quote_number} {r ? formatRevision(r.revision_no) : ""}
                        <p className="max-w-[24ch] truncate text-xs">{q?.title}</p>
                      </Td>
                      <Td>{po?.po_number}</Td>
                      <Td>
                        <div className="flex flex-wrap gap-1">
                          {o.status === "po_mismatch_review" ? <StatusBadge status={o.status} /> : null}
                          <StatusBadge status={o.payment_status} />
                        </div>
                      </Td>
                      <Td className="text-right tabular-nums">{formatMoney(o.total_amount, o.currency, L)}</Td>
                      <Td className={cn("text-right tabular-nums", balance > 0 ? "font-medium" : "text-muted")}>
                        {formatMoney(balance.toFixed(2), o.currency, L)}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <div className="flex flex-wrap justify-end gap-x-8 gap-y-1 border-t border-line px-5 py-3 text-sm">
              <span>
                <span className="text-muted">{O.total} </span>
                <span className="font-medium tabular-nums">
                  {formatTotalsByCurrency(shown.map((o) => ({ currency: o.currency, amount: o.total_amount })), L)}
                </span>
              </span>
              <span>
                <span className="text-muted">{O.balance} </span>
                <span className="font-medium tabular-nums">
                  {formatTotalsByCurrency(shown.map((o) => ({ currency: o.currency, amount: Number(o.total_amount) - Number(o.amount_paid) })), L)}
                </span>
              </span>
            </div>
          </>
        ) : (
          <EmptyState title={O.empty}>{O.emptyBody}</EmptyState>
        )}
      </Panel>
    </>
  );
}
