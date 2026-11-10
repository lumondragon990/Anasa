import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { EmptyState, PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { DocRef } from "@/components/doc-ref";
import { formatDate, formatMoney, formatRevision } from "@/lib/utils";
import { addContact, addLocation, changeCustomerCode, removeContact, removeLocation } from "../actions";
import { AddContactForm, AddLocationForm, ChangeCodeForm } from "./detail-forms";
import { getT } from "@/lib/i18n/server";
import { translateMessage } from "@/lib/i18n/messages";


export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireInternalUser();
  const supabase = await createClient();

  const [{ data: c }, contacts, locations, quotes, orders, history] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).maybeSingle(),
    supabase.from("customer_contacts").select("*").eq("customer_id", id).order("is_primary", { ascending: false }).order("first_name"),
    supabase.from("customer_locations").select("*").eq("customer_id", id).order("kind").order("label"),
    supabase
      .from("quotations")
      .select("id, quote_number, title, status, created_at, quotation_revisions!quotations_current_revision_fk(revision_no, subtotal), currency")
      .eq("customer_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("sales_orders")
      .select("id, order_number, status, payment_status, total_amount, currency, converted_at, quotations!sales_orders_source_quotation_id_fkey(quote_number), quotation_revisions!sales_orders_source_revision_id_fkey(revision_no), customer_purchase_orders(po_number)")
      .eq("customer_id", id)
      .order("converted_at", { ascending: false }),
    supabase.from("customer_code_history").select("*").eq("customer_id", id).order("changed_at", { ascending: false }),
  ]);
  if (!c) notFound();
  const { t, locale } = await getT();
  const T = t.customers;
  const L = t.localeTag;

  const canWrite = can(user.role, "customers.write");
  const address = [c.billing_line1, c.billing_line2, [c.billing_city, c.billing_state, c.billing_postal_code].filter(Boolean).join(", "), c.billing_country]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <PageHeader
        title={c.display_name}
        description={c.legal_name !== c.display_name ? c.legal_name : undefined}
        actions={
          <>
            {canWrite ? (
              <Link href={`/customers/${id}/edit`} className={buttonVariants({ variant: "secondary" })}>
                <Pencil /> {t.common.edit}
              </Link>
            ) : null}
            {can(user.role, "quotes.create") ? (
              <Link href={`/quotations/new?customer=${id}`} className={buttonVariants()}>
                <Plus /> {t.quotes.newQuotation}
              </Link>
            ) : null}
          </>
        }
      >
        <Link href="/customers" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {T.title}
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHeader title={T.quotations} description={T.issued(quotes.data?.length ?? 0)} />
            {quotes.data && quotes.data.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{T.number}</Th>
                    <Th>{t.common.subject}</Th>
                    <Th>{t.common.status}</Th>
                    <Th className="text-right">{t.common.value}</Th>
                  </tr>
                </thead>
                <tbody>
                  {quotes.data.map((q) => {
                    const rev = q.quotation_revisions as unknown as { revision_no: number; subtotal: number } | null;
                    return (
                      <Tr key={q.id}>
                        <Td>
                          <Link href={`/quotations/${q.id}`} className="hover:underline">
                            <DocRef value={q.quote_number} size="sm" />
                          </Link>
                          {rev ? <span className="ml-2 text-xs text-muted">{formatRevision(rev.revision_no)}</span> : null}
                        </Td>
                        <Td className="max-w-[26ch] truncate">{q.title}</Td>
                        <Td>
                          <StatusBadge status={q.status} />
                        </Td>
                        <Td className="text-right tabular-nums">{rev ? formatMoney(rev.subtotal, q.currency, L) : "—"}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState title={T.noQuotes} />
            )}
          </Panel>

          <Panel>
            <PanelHeader title={T.salesOrders} />
            {orders.data && orders.data.length ? (
              <Table>
                <thead>
                  <tr>
                    <Th>{T.order}</Th>
                    <Th>{T.fromQuote}</Th>
                    <Th>{T.customerPo}</Th>
                    <Th>{t.common.status}</Th>
                    <Th className="text-right">{t.common.total}</Th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data.map((o) => {
                    const q = o.quotations as unknown as { quote_number: string } | null;
                    const r = o.quotation_revisions as unknown as { revision_no: number } | null;
                    const po = o.customer_purchase_orders as unknown as { po_number: string } | null;
                    return (
                      <Tr key={o.id}>
                        <Td>
                          <Link href={`/sales-orders/${o.id}`} className="hover:underline">
                            <DocRef value={o.order_number} size="sm" />
                          </Link>
                        </Td>
                        <Td className="text-muted">
                          {q?.quote_number} {r ? formatRevision(r.revision_no) : ""}
                        </Td>
                        <Td>{po?.po_number}</Td>
                        <Td>
                          <div className="flex flex-wrap gap-1">
                            {o.status === "po_mismatch_review" ? <StatusBadge status={o.status} /> : null}
                            <StatusBadge status={o.payment_status} />
                          </div>
                        </Td>
                        <Td className="text-right tabular-nums">{formatMoney(o.total_amount, o.currency, L)}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            ) : (
              <EmptyState title={T.noOrders}>{T.noOrdersBody}</EmptyState>
            )}
          </Panel>

          <Panel>
            <PanelHeader title={T.contacts} />
            <ul className="divide-y divide-line">
              {(contacts.data ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 px-5 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="font-medium">
                      {p.first_name} {p.last_name}
                      {p.is_primary ? <span className="ml-2 text-xs font-normal text-accent">{t.common.primary}</span> : null}
                    </p>
                    <p className="text-muted">{[p.title, p.email, p.phone].filter(Boolean).join(", ") || t.common.noDetails}</p>
                  </div>
                  {canWrite ? (
                    <form action={removeContact.bind(null, id, p.id)}>
                      <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t.common.remove(p.first_name)}>
                        <Trash2 />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
              {!contacts.data?.length ? <li className="px-5 py-4 text-sm text-muted">{T.noContacts}</li> : null}
            </ul>
            {canWrite ? (
              <div className="border-t border-line px-5 py-4">
                <AddContactForm action={addContact.bind(null, id)} />
              </div>
            ) : null}
          </Panel>

          <Panel>
            <PanelHeader title={T.locations} description={T.locationsDescription} />
            <ul className="divide-y divide-line">
              {(locations.data ?? []).map((l) => (
                <li key={l.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">
                      {l.label} <span className="ml-1 text-xs font-normal text-muted">{T.kind[l.kind]}</span>
                    </p>
                    <p className="text-muted">{[l.line1, l.city, l.state, l.postal_code, l.country].filter(Boolean).join(", ") || T.noAddress}</p>
                    {l.site_notes ? <p className="mt-1 text-muted">{l.site_notes}</p> : null}
                  </div>
                  {canWrite ? (
                    <form action={removeLocation.bind(null, id, l.id)}>
                      <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t.common.remove(l.label)}>
                        <Trash2 />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
              {!locations.data?.length ? <li className="px-5 py-4 text-sm text-muted">{T.noLocations}</li> : null}
            </ul>
            {canWrite ? (
              <div className="border-t border-line px-5 py-4">
                <AddLocationForm action={addLocation.bind(null, id)} />
              </div>
            ) : null}
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel className="p-5">
            <p className="text-sm text-muted">{T.codeCardLabel}</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <p className="text-4xl font-semibold tracking-[0.12em]">{c.customer_code}</p>
              <StatusBadge status={c.status} />
            </div>
            <p className="mt-2 text-xs text-muted">
              {T.codeCardHint(c.customer_code)}
            </p>
            {c.customer_code === "ANA" ? (
              <p className="mt-3 rounded-[var(--radius-control)] bg-warn-soft px-3 py-2 text-xs text-warn">
                {T.codeIsAna}
              </p>
            ) : null}
            {can(user.role, "customers.changeCode") ? (
              <ChangeCodeForm action={changeCustomerCode.bind(null, id)} current={c.customer_code} />
            ) : null}
          </Panel>

          <Panel className="p-5 text-sm">
            <dl className="flex flex-col gap-3">
              <Detail label={T.paymentTerms} value={c.payment_terms} />
              <Detail label={t.common.currency} value={c.currency} />
              <Detail label={t.common.email} value={c.email} />
              <Detail label={t.common.phone} value={c.phone} />
              <Detail label={t.common.website} value={c.website} />
              <Detail label={T.rfc} value={c.tax_id} />
              <Detail label={T.billingAddress} value={address} multiline />
            </dl>
            {c.notes ? <p className="mt-4 whitespace-pre-line border-t border-line pt-4 text-muted">{c.notes}</p> : null}
          </Panel>

          <Panel>
            <PanelHeader title={T.codeHistory} />
            <ol className="px-5 py-3 text-sm">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="border-l border-line py-2 pl-4">
                  <p className="font-medium">
                    {h.old_code ? T.codeChange(h.old_code, h.new_code) : h.new_code}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(h.changed_at, L)}
                    {h.reason ? `, ${translateMessage(h.reason, locale)}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </aside>
      </div>
    </>
  );
}

function Detail({ label, value, multiline }: { label: string; value: string | null; multiline?: boolean }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2">
      <dt className="text-muted">{label}</dt>
      <dd className={multiline ? "whitespace-pre-line" : "truncate"}>{value || "—"}</dd>
    </div>
  );
}
