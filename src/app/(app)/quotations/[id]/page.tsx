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
import { lineTotal, marginPercent, toMoney } from "@/lib/money";
import Decimal from "decimal.js";
import { FileUpload } from "@/components/documents/file-upload";
import { DocumentList, type DocumentRow } from "@/components/documents/document-list";
import { addLine, addSupplierQuote, approveRevision, newRevision, recordCustomerPo, removeLine, renumberQuotation, setSupplierQuoteStatus } from "../actions";
import { getT } from "@/lib/i18n/server";
import { translateMessage } from "@/lib/i18n/messages";
import { AddLineForm, ApproveForm, CustomerPoForm, NewRevisionForm, RenumberForm, SupplierQuoteForm } from "./quote-forms";

type SupplierQuote = {
  id: string;
  supplier_quote_number: string;
  quote_date: string | null;
  valid_until: string | null;
  currency: string;
  total_amount: string | null;
  freight: string;
  lead_time: string | null;
  notes: string | null;
  status: string;
  suppliers: { id: string; display_name: string; supplier_code: string } | null;
};

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
  const { t, locale } = await getT();
  const Q = t.quotes;
  const L = t.localeTag;
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
    .select("id, order_number, status, payment_status")
    .eq("source_quotation_id", id)
    .maybeSingle();

  const seeCosts = can(user.role, "costs.view");
  const path = `/quotations/${id}`;
  const [docs, history, supplierQuotes, suppliers] = await Promise.all([
    supabase.from("documents").select("id, file_name, category, size_bytes, uploaded_at").eq("quotation_id", id).is("supplier_quote_id", null).order("uploaded_at"),
    supabase.from("quotation_number_history").select("*").eq("quotation_id", id).order("changed_at"),
    seeCosts
      ? supabase
          .from("supplier_quotes")
          .select("id, supplier_quote_number, quote_date, valid_until, currency, total_amount, freight, lead_time, notes, status, suppliers(id, display_name, supplier_code)")
          .eq("quotation_id", id)
          .order("created_at")
      : Promise.resolve({ data: [] as SupplierQuote[] }),
    seeCosts
      ? supabase.from("suppliers").select("id, supplier_code, display_name, currency").neq("status", "inactive").order("display_name")
      : Promise.resolve({ data: [] }),
  ]);
  const sqList = (supplierQuotes.data ?? []) as unknown as SupplierQuote[];
  const sqDocs = sqList.length
    ? ((await supabase.from("documents").select("id, file_name, category, size_bytes, uploaded_at, supplier_quote_id").in("supplier_quote_id", sqList.map((x) => x.id)).order("uploaded_at")).data ?? [])
    : [];
  const canDeleteFiles = ["super_admin", "director"].includes(user.role);
  const anyLocked = revisions.some((r) => r.is_locked);
  const canRenumber = can(user.role, "quotes.approve") && !anyLocked && ["draft", "under_review"].includes(q.status);

  // Cost of the supplier quotations marked Selected, in the quotation currency.
  const selected = sqList.filter((x) => x.status === "selected");
  const sameCurrency = selected.every((x) => x.currency === q.currency);
  const selectedCost = selected.reduce((sum, x) => sum.plus(x.total_amount ?? 0).plus(x.freight ?? 0), new Decimal(0));
  const sell = new Decimal(current.subtotal ?? 0);
  const margin = selected.length && sameCurrency && sell.gt(0) ? marginPercent(selectedCost, sell).toFixed(1) : null;

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
          {Q.title}
        </Link>
      </PageHeader>

      {q.customer_code_at_issue !== customer.customer_code ? (
        <p className="mb-6 rounded-[var(--radius-control)] bg-surface-2 px-4 py-3 text-sm text-muted">
          {Q.codeAtIssue(q.customer_code_at_issue, customer.customer_code)}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <nav aria-label={Q.revisions} className="flex flex-wrap gap-1 border-b border-line">
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
                {r.is_locked ? <Lock className="size-3" aria-label={Q.locked} /> : null}
              </Link>
            ))}
          </nav>

          <Panel>
            <PanelHeader
              title={Q.lineItems(formatRevision(shown.revision_no))}
              description={
                shown.is_locked
                  ? Q.approvedLocked(formatDate(shown.approved_at, L))
                  : Q.draftEditable
              }
              actions={<StatusBadge status={shown.status} />}
            />
            {lines && lines.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th className="w-10">#</Th>
                    <Th>{Q.description_}</Th>
                    <Th className="text-right">{Q.qty}</Th>
                    <Th className="text-right">{Q.unitPrice}</Th>
                    <Th className="text-right">{Q.disc}</Th>
                    <Th className="text-right">{t.common.total}</Th>
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
                          {[Q.lineType[l.line_type], l.manufacturer, l.part_number].filter(Boolean).join(", ")}
                        </p>
                      </Td>
                      <Td className="text-right tabular-nums">
                        {Number(l.quantity)} {l.unit}
                      </Td>
                      <Td className="text-right tabular-nums">{formatMoney(l.unit_price, q.currency, L)}</Td>
                      <Td className="text-right tabular-nums text-muted">{Number(l.discount_pct) ? `${Number(l.discount_pct)}%` : "—"}</Td>
                      <Td className="text-right font-medium tabular-nums">
                        {formatMoney(toMoney(lineTotal(String(l.quantity), String(l.unit_price), String(l.discount_pct))), q.currency, L)}
                      </Td>
                      {editable ? (
                        <Td>
                          <form action={removeLine.bind(null, id, l.id)}>
                            <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={Q.removeLine(l.line_no)}>
                              <Trash2 />
                            </button>
                          </form>
                        </Td>
                      ) : null}
                    </Tr>
                  ))}
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-right text-sm text-muted">
                      {Q.subtotal}
                    </td>
                    <td className="px-4 py-3 text-right text-base font-semibold tabular-nums">{formatMoney(shown.subtotal, q.currency, L)}</td>
                    {editable ? <td /> : null}
                  </tr>
                </tbody>
              </Table>
            ) : (
              <EmptyState title={Q.noLines}>{editable ? Q.noLinesBody : null}</EmptyState>
            )}
            {editable ? (
              <div className="border-t border-line px-5 py-5">
                <AddLineForm action={addLine.bind(null, id, shown.id)} />
                <p className="mt-3 text-xs text-muted">
                  {Q.costNote}
                </p>
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title={Q.files} description={Q.filesHint} />
            <div className="flex flex-col gap-4 px-5 py-4">
              <DocumentList docs={(docs.data ?? []) as DocumentRow[]} canDelete={canDeleteFiles} revalidate={path} />
              <FileUpload target="quotation" recordId={id} revalidate={path} defaultCategory="customer_rfq" />
            </div>
          </Panel>

          {seeCosts ? (
            <Panel>
              <PanelHeader
                title={Q.supplierQuotes}
                description={Q.supplierQuotesHint}
              />
              {selected.length ? (
                <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-line bg-surface-2 px-5 py-3 text-sm">
                  <span>
                    <span className="text-muted">{Q.selectedCost} </span>
                    <span className="font-medium tabular-nums">{sameCurrency ? formatMoney(selectedCost.toFixed(2), q.currency, L) : Q.mixedCurrencies}</span>
                  </span>
                  <span>
                    <span className="text-muted">{Q.sellingPrice(formatRevision(current.revision_no))} </span>
                    <span className="font-medium tabular-nums">{formatMoney(current.subtotal, q.currency, L)}</span>
                  </span>
                  <span>
                    <span className="text-muted">{Q.grossMargin} </span>
                    <span className={cn("font-semibold tabular-nums", margin !== null && Number(margin) < 0 ? "text-danger" : "text-ok")}>
                      {margin !== null ? `${margin}%` : "—"}
                    </span>
                  </span>
                </div>
              ) : null}
              <ul className="divide-y divide-line">
                {sqList.map((sq) => (
                  <li key={sq.id} className="flex flex-col gap-3 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 text-sm">
                        <p className="font-medium">
                          {sq.suppliers?.display_name} <span className="text-muted">{Q.sqTitle(sq.supplier_quote_number)}</span>
                        </p>
                        <p className="text-muted">
                          {[
                            sq.quote_date ? Q.dated(formatDate(sq.quote_date, L)) : null,
                            sq.valid_until ? Q.validUntilShort(formatDate(sq.valid_until, L)) : null,
                            sq.lead_time ? Q.leadTimeShort(sq.lead_time) : null,
                          ]
                            .filter(Boolean)
                            .join(", ") || Q.noDates}
                        </p>
                        {sq.notes ? <p className="mt-1 text-muted">{sq.notes}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="font-semibold tabular-nums">{formatMoney(sq.total_amount, sq.currency, L)}</p>
                        {Number(sq.freight) ? <p className="text-xs text-muted">{Q.plusFreight(formatMoney(sq.freight, sq.currency, L))}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-muted">{t.common.status}</span>
                      {(["received", "selected", "not_selected"] as const).map((st) => (
                        <form key={st} action={setSupplierQuoteStatus.bind(null, id, sq.id, st)}>
                          <button
                            type="submit"
                            aria-pressed={sq.status === st}
                            className={cn(
                              "h-7 rounded-full border px-3 text-xs",
                              sq.status === st ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:text-fg",
                            )}
                          >
                            {t.status[st]}
                          </button>
                        </form>
                      ))}
                    </div>
                    <div className="rounded-[var(--radius-control)] border border-line px-3 py-2">
                      <DocumentList
                        docs={sqDocs.filter((d) => d.supplier_quote_id === sq.id) as DocumentRow[]}
                        canDelete={canDeleteFiles}
                        revalidate={path}
                        empty={Q.noSupplierPdf}
                      />
                      <div className="mt-2">
                        <FileUpload target="supplier_quote" recordId={sq.id} revalidate={path} showCategory={false} label={Q.attachSupplierPdf} />
                      </div>
                    </div>
                  </li>
                ))}
                {!sqList.length ? <li className="px-5 py-4 text-sm text-muted">{Q.noSupplierQuotes}</li> : null}
              </ul>
              <div className="border-t border-line px-5 py-4">
                <SupplierQuoteForm
                  action={addSupplierQuote.bind(null, id)}
                  suppliers={(suppliers.data ?? []) as { id: string; supplier_code: string; display_name: string; currency: string }[]}
                  currency={q.currency}
                />
              </div>
            </Panel>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6">
          <Panel className="p-5 text-sm">
            <p className="text-muted">{Q.quoteNumber}</p>
            <p className="mt-1 break-all text-base font-semibold">{q.quote_number}</p>
            {q.is_manual_number ? <p className="mt-1 text-xs text-muted">{Q.setByHand}</p> : null}
            {canRenumber ? (
              <div className="mt-3">
                <RenumberForm action={renumberQuotation.bind(null, id)} current={q.quote_number} />
              </div>
            ) : anyLocked ? (
              <p className="mt-2 text-xs text-muted">{Q.permanent}</p>
            ) : null}
            {history.data && history.data.length > 1 ? (
              <ol className="mt-4 border-t border-line pt-3">
                {history.data.map((h) => (
                  <li key={h.id} className="py-1 text-xs text-muted">
                    {formatDate(h.changed_at, L)}: {h.old_number ? `${t.customers.codeChange(h.old_number, "")}` : ""}
                    <span className="text-fg">{h.new_number}</span>
                    {h.reason ? `, ${translateMessage(h.reason, locale)}` : ""}
                  </li>
                ))}
              </ol>
            ) : null}
          </Panel>

          <Panel className="p-5 text-sm">
            <dl className="flex flex-col gap-3">
              {[
                [Q.customerReference, q.customer_reference],
                [t.common.currency, q.currency],
                [Q.validUntil, q.valid_until ? formatDate(q.valid_until, L) : null],
                [t.common.created, formatDate(q.created_at, L)],
                [Q.revisionReason, shown.reason ? translateMessage(shown.reason, locale) : null],
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
              <p className="text-sm text-muted">{Q.convertedTo}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <DocRef value={order.order_number} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge status={order.status} />
                <StatusBadge status={order.payment_status} />
              </div>
              <Link href={`/sales-orders/${order.id}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "mt-4")}>
                {Q.viewOrder}
              </Link>
            </Panel>
          ) : ["approved", "sent", "customer_reviewing", "accepted"].includes(q.status) && current.is_locked && can(user.role, "orders.convert") ? (
            <Panel className="border-accent/40 p-5">
              <h2 className="text-[15px] font-semibold">{Q.poPanelTitle}</h2>
              <p className="mb-4 mt-1 text-sm text-muted">{Q.poPanelBody}</p>
              <CustomerPoForm action={recordCustomerPo.bind(null, id)} quoteTotal={formatMoney(current.subtotal, q.currency, L)} />
            </Panel>
          ) : null}

          {isCurrent && !shown.is_locked && !closed && can(user.role, "quotes.approve") ? (
            <Panel className="p-5">
              <h2 className="mb-3 text-[15px] font-semibold">{Q.approveTitle(formatRevision(shown.revision_no))}</h2>
              <ApproveForm action={approveRevision.bind(null, id, shown.id)} />
            </Panel>
          ) : null}

          {isCurrent && shown.is_locked && !closed && can(user.role, "quotes.create") ? (
            <Panel className="p-5">
              <h2 className="mb-1 text-[15px] font-semibold">{Q.reviseTitle}</h2>
              <p className="mb-3 text-sm text-muted">
                {Q.reviseBody(formatRevision(shown.revision_no), formatRevision(shown.revision_no + 1))}
              </p>
              <NewRevisionForm action={newRevision.bind(null, id)} />
            </Panel>
          ) : null}

          {!isCurrent ? (
            <Link href={`/quotations/${id}`} className={buttonVariants({ variant: "secondary" })}>
              {Q.goCurrent}
            </Link>
          ) : null}
        </aside>
      </div>
    </>
  );
}
