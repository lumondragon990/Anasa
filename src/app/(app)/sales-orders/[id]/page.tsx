import Link from "next/link";
import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { DocRef } from "@/components/doc-ref";
import { FileUpload } from "@/components/documents/file-upload";
import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import { cn, formatDate, formatMoney, formatRevision } from "@/lib/utils";
import { lineTotal, toMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";
import { deletePayment, recordPayment, resolvePoMismatch } from "../actions";
import { PaymentForm, ReviewForm } from "./forms";

export default async function SalesOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireInternalUser();
  const { t } = await getT();
  const O = t.orders;
  const L = t.localeTag;
  const supabase = await createClient();

  const { data: o } = await supabase
    .from("sales_orders")
    .select(
      "*, customers(id, display_name), quotations!sales_orders_source_quotation_id_fkey(id, quote_number, title), quotation_revisions!sales_orders_source_revision_id_fkey(revision_no), customer_purchase_orders(po_number, po_date, total_amount, received_at, notes)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!o) notFound();

  const customer = o.customers as { id: string; display_name: string };
  const quote = o.quotations as { id: string; quote_number: string; title: string };
  const rev = o.quotation_revisions as { revision_no: number };
  const po = o.customer_purchase_orders as { po_number: string; po_date: string | null; total_amount: string | null; received_at: string; notes: string | null };

  const [{ data: lines }, { data: payments }, { data: docs }, { data: profiles }] = await Promise.all([
    supabase.from("sales_order_lines").select("*").eq("sales_order_id", id).order("line_no"),
    supabase.from("payments").select("*").eq("sales_order_id", id).order("paid_on"),
    supabase.from("documents").select("id, file_name, category, size_bytes, uploaded_at").eq("quotation_id", quote.id).is("supplier_quote_id", null).order("uploaded_at"),
    supabase.from("profiles").select("id, full_name, email"),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));
  const balance = (Number(o.total_amount) - Number(o.amount_paid)).toFixed(2);
  const inReview = o.status === "po_mismatch_review";
  const today = new Date().toISOString().slice(0, 10);
  const path = `/sales-orders/${id}`;

  return (
    <>
      <PageHeader
        title={<DocRef value={o.order_number} size="lg" />}
        description={
          <>
            <Link href={`/customers/${customer.id}`} className="text-fg hover:underline">
              {customer.display_name}
            </Link>
            {`, ${quote.title}`}
          </>
        }
        actions={
          <>
            <StatusBadge status={o.status} />
            <StatusBadge status={o.payment_status} />
          </>
        }
      >
        <Link href="/sales-orders" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {O.backToOrders}
        </Link>
      </PageHeader>

      {inReview ? (
        <Panel className="mb-6 border-danger/50 p-5">
          <h2 className="text-[15px] font-semibold text-danger">{O.reviewTitle}</h2>
          <p className="mb-4 mt-1 text-sm text-muted">
            {O.reviewBody(formatMoney(po.total_amount, o.currency, L), formatMoney(o.total_amount, o.currency, L))}
          </p>
          {can(user.role, "orders.convert") ? <ReviewForm action={resolvePoMismatch.bind(null, id)} poTotal={po.total_amount ? formatMoney(po.total_amount, o.currency, L) : null} /> : null}
        </Panel>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHeader title={O.payments} description={O.paymentsHint} />
            <div className="grid grid-cols-3 gap-px border-b border-line bg-line">
              {[
                [O.total, formatMoney(o.total_amount, o.currency, L), ""],
                [O.paid, formatMoney(o.amount_paid, o.currency, L), "text-ok"],
                [O.balanceDue, formatMoney(balance, o.currency, L), Number(balance) > 0 ? "" : "text-muted"],
              ].map(([label, value, tone]) => (
                <div key={label} className="bg-surface px-5 py-4">
                  <p className="text-sm text-muted">{label}</p>
                  <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</p>
                </div>
              ))}
            </div>
            {o.payment_status === "paid" && o.paid_at ? (
              <p className="border-b border-line bg-ok-soft px-5 py-2 text-sm text-ok">{O.paidInFull(formatDate(o.paid_at, L))}</p>
            ) : null}
            {payments && payments.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{O.paidOn}</Th>
                    <Th>{O.method}</Th>
                    <Th>{O.reference}</Th>
                    <Th>{t.admin.by}</Th>
                    <Th className="text-right">{O.amount}</Th>
                    {can(user.role, "payments.delete") ? <Th className="w-10" /> : null}
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <Tr key={p.id}>
                      <Td>{formatDate(p.paid_on, L)}</Td>
                      <Td>{O.methods[p.method]}</Td>
                      <Td className="text-muted">{p.reference ?? "—"}</Td>
                      <Td className="text-muted">{names.get(p.recorded_by) ?? "—"}</Td>
                      <Td className="text-right font-medium tabular-nums">{formatMoney(p.amount, p.currency, L)}</Td>
                      {can(user.role, "payments.delete") ? (
                        <Td>
                          <form action={deletePayment.bind(null, id, p.id)}>
                            <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={O.deletePayment}>
                              <Trash2 />
                            </button>
                          </form>
                        </Td>
                      ) : null}
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <p className="px-5 py-4 text-sm text-muted">{O.noPayments}</p>
            )}
            {can(user.role, "payments.record") && Number(balance) > 0 && o.status !== "cancelled" ? (
              <div className="border-t border-line px-5 py-5">
                <PaymentForm action={recordPayment.bind(null, id, o.currency)} balance={balance} today={today} />
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title={O.lines} />
            {lines && lines.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10">#</Th>
                    <Th>{t.quotes.description_}</Th>
                    <Th className="text-right">{t.quotes.qty}</Th>
                    <Th className="text-right">{t.quotes.unitPrice}</Th>
                    <Th className="text-right">{t.common.total}</Th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <Tr key={l.id}>
                      <Td className="text-muted">{l.line_no}</Td>
                      <Td>
                        <p>{l.description}</p>
                        <p className="text-xs text-muted">{[t.quotes.lineType[l.line_type], l.manufacturer, l.part_number].filter(Boolean).join(", ")}</p>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {Number(l.quantity)} {l.unit}
                      </Td>
                      <Td className="text-right tabular-nums">{formatMoney(l.unit_price, o.currency, L)}</Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatMoney(toMoney(lineTotal(String(l.quantity), String(l.unit_price), String(l.discount_pct))), o.currency, L)}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            ) : (
              <EmptyState title={t.quotes.noLines} />
            )}
          </Panel>

          <Panel>
            <PanelHeader title={O.files} description={O.filesHint} />
            <div className="flex flex-col gap-4 px-5 py-4">
              <DocumentList docs={(docs ?? []) as DocumentRow[]} canDelete={["super_admin", "director"].includes(user.role)} revalidate={path} />
              <FileUpload target="quotation" recordId={quote.id} revalidate={path} defaultCategory="customer_po" />
            </div>
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel className="p-5 text-sm">
            <dl className="flex flex-col gap-3">
              <div className="grid grid-cols-[7.5rem_1fr] gap-2">
                <dt className="text-muted">{O.quote}</dt>
                <dd>
                  <Link href={`/quotations/${quote.id}`} className="hover:underline">
                    {quote.quote_number}
                  </Link>{" "}
                  <span className="text-muted">{formatRevision(rev.revision_no)}</span>
                </dd>
              </div>
              {[
                [O.customerPo, po.po_number],
                [O.poDate, po.po_date ? formatDate(po.po_date, L) : null],
                [O.poTotal, po.total_amount ? formatMoney(po.total_amount, o.currency, L) : null],
                [O.received, formatDate(po.received_at, L)],
                [t.quotes.poNotes, po.notes],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[7.5rem_1fr] gap-2">
                  <dt className="text-muted">{label}</dt>
                  <dd className="break-words">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 border-t border-line pt-3 text-xs text-muted">{O.approvedOn(formatDate(o.converted_at, L))}</p>
            {o.po_review_note ? <p className="mt-2 text-xs text-muted">{O.reviewedNote(o.po_review_note)}</p> : null}
          </Panel>
        </aside>
      </div>
    </>
  );
}
