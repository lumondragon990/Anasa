import Link from "next/link";
import { notFound } from "next/navigation";
import { Lock, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, Panel, PanelHeader, EmptyState } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { DocRef } from "@/components/doc-ref";
import { cn, formatDate, formatMoney, formatRevision } from "@/lib/utils";
import { lineTotal, toMoney } from "@/lib/money";
import { addLine, approveRevision, newRevision, removeLine } from "../actions";
import { AddLineForm, ApproveForm, NewRevisionForm } from "./quote-forms";

export default async function QuotationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ rev?: string }>;
}) {
  const { id } = await params;
  const { rev } = await searchParams;
  const user = await requireInternalUser();
  const supabase = await createClient();

  const [{ data: q }, { data: revisions }] = await Promise.all([
    supabase.from("quotations").select("*, customers(id, display_name, customer_code)").eq("id", id).maybeSingle(),
    supabase.from("quotation_revisions").select("*").eq("quotation_id", id).order("revision_no"),
  ]);
  if (!q || !revisions) notFound();

  const current = revisions.find((r) => r.id === q.current_revision_id) ?? revisions[revisions.length - 1];
  const shown = rev !== undefined ? (revisions.find((r) => String(r.revision_no) === rev) ?? current) : current;
  const isCurrent = shown.id === current.id;

  const { data: lines } = await supabase
    .from("quotation_line_items")
    .select("*")
    .eq("revision_id", shown.id)
    .order("line_no");

  const { data: order } = await supabase
    .from("sales_orders")
    .select("id, order_number, status")
    .eq("source_quotation_id", id)
    .maybeSingle();

  const customer = q.customers as { id: string; display_name: string; customer_code: string };
  const editable = isCurrent && !shown.is_locked && can(user.role, "quotes.create");
  const closed = ["converted", "cancelled"].includes(q.status);

  return (
    <>
      <PageHeader
        title={<DocRef value={q.quote_number} size="lg" />}
        description={
          <>
            <Link href={`/customers/${customer.id}`} className="text-fg hover:underline">
              {customer.display_name}
            </Link>
            {`, ${q.title}`}
          </>
        }
        actions={<StatusBadge status={q.status} />}
      >
        <Link href="/quotations" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          Quotations
        </Link>
      </PageHeader>

      {q.customer_code_at_issue !== customer.customer_code ? (
        <p className="mb-6 rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-muted">
          Issued while the customer code was {q.customer_code_at_issue}. The number is kept as issued; the customer now
          uses {customer.customer_code}.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <nav aria-label="Revisions" className="flex flex-wrap gap-1 border-b border-line">
            {revisions.map((r) => (
              <Link
                key={r.id}
                href={`/quotations/${id}?rev=${r.revision_no}`}
                aria-current={r.id === shown.id ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm",
                  r.id === shown.id ? "border-accent font-medium text-fg" : "border-transparent text-muted hover:text-fg",
                )}
              >
                {formatRevision(r.revision_no)}
                {r.is_locked ? <Lock className="size-3" aria-label="locked" /> : null}
              </Link>
            ))}
          </nav>

          <Panel>
            <PanelHeader
              title={`${formatRevision(shown.revision_no)} line items`}
              description={
                shown.is_locked
                  ? `Approved ${formatDate(shown.approved_at)}. This revision is locked and kept exactly as approved.`
                  : "Draft. Lines can be changed until the revision is approved."
              }
              actions={<StatusBadge status={shown.status} />}
            />
            {lines && lines.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10">#</Th>
                    <Th>Description</Th>
                    <Th className="text-right">Qty</Th>
                    <Th className="text-right">Unit price</Th>
                    <Th className="text-right">Disc.</Th>
                    <Th className="text-right">Total</Th>
                    {editable ? <Th className="w-10" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <Tr key={l.id}>
                      <Td className="text-muted">{l.line_no}</Td>
                      <Td>
                        <p>{l.description}</p>
                        <p className="text-xs text-muted">
                          {[l.line_type, l.manufacturer, l.part_number].filter(Boolean).join(", ")}
                        </p>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {Number(l.quantity)} {l.unit}
                      </Td>
                      <Td className="text-right tabular-nums">{formatMoney(l.unit_price, q.currency)}</Td>
                      <Td className="text-right tabular-nums text-muted">{Number(l.discount_pct) ? `${Number(l.discount_pct)}%` : "—"}</Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatMoney(toMoney(lineTotal(String(l.quantity), String(l.unit_price), String(l.discount_pct))), q.currency)}
                      </Td>
                      {editable ? (
                        <Td>
                          <form action={removeLine.bind(null, id, l.id)}>
                            <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={`Remove line ${l.line_no}`}>
                              <Trash2 />
                            </button>
                          </form>
                        </Td>
                      ) : null}
                    </Tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-right text-sm text-muted">
                      Subtotal
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">{formatMoney(shown.subtotal, q.currency)}</td>
                    {editable ? <td /> : null}
                  </tr>
                </tbody>
              </Table>
            ) : (
              <EmptyState title="No lines yet">{editable ? "Add the products and services being quoted below." : null}</EmptyState>
            )}
            {editable ? (
              <div className="border-t border-line px-5 py-5">
                <AddLineForm action={addLine.bind(null, id, shown.id)} />
                <p className="mt-3 text-xs text-muted">
                  Cost build-up, markup and margin calculation are added in Phase 5. Supplier costs are stored separately
                  and never appear on customer documents.
                </p>
              </div>
            ) : null}
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel className="p-5 text-sm">
            <dl className="flex flex-col gap-3">
              {[
                ["Customer reference", q.customer_reference],
                ["Currency", q.currency],
                ["Valid until", q.valid_until ? formatDate(q.valid_until) : null],
                ["Created", formatDate(q.created_at)],
                ["Revision reason", shown.reason],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[8rem_1fr] gap-2">
                  <dt className="text-muted">{label}</dt>
                  <dd>{value || "—"}</dd>
                </div>
              ))}
            </dl>
          </Panel>

          {order ? (
            <Panel className="p-5">
              <p className="text-sm text-muted">Converted to sales order</p>
              <div className="mt-2">
                <DocRef value={order.order_number} />
              </div>
            </Panel>
          ) : null}

          {isCurrent && !shown.is_locked && !closed && can(user.role, "quotes.approve") ? (
            <Panel className="p-5">
              <h2 className="mb-3 text-[15px] font-semibold">Approve {formatRevision(shown.revision_no)}</h2>
              <ApproveForm action={approveRevision.bind(null, id, shown.id)} />
            </Panel>
          ) : null}

          {isCurrent && shown.is_locked && !closed && can(user.role, "quotes.create") ? (
            <Panel className="p-5">
              <h2 className="mb-1 text-[15px] font-semibold">Revise this quotation</h2>
              <p className="mb-3 text-sm text-muted">
                Copies {formatRevision(shown.revision_no)} into {formatRevision(shown.revision_no + 1)}. The quote number stays
                the same and {formatRevision(shown.revision_no)} is kept unchanged.
              </p>
              <NewRevisionForm action={newRevision.bind(null, id)} />
            </Panel>
          ) : null}

          {!isCurrent ? (
            <Link href={`/quotations/${id}`} className={buttonVariants({ variant: "secondary" })}>
              Go to current revision
            </Link>
          ) : null}
        </aside>
      </div>
    </>
  );
}
