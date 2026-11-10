import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/utils";
import { AddContactForm } from "@/app/(app)/customers/[id]/detail-forms";
import { addCapability, addSupplierContact, removeCapability, removeSupplierContact } from "../actions";
import { CapabilityForm } from "./capability-form";
import { getT } from "@/lib/i18n/server";


export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireInternalUser();
  const supabase = await createClient();
  const [{ data: s }, contacts, caps] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).maybeSingle(),
    supabase.from("supplier_contacts").select("*").eq("supplier_id", id).order("is_primary", { ascending: false }),
    supabase.from("supplier_capabilities").select("*").eq("supplier_id", id).order("value"),
  ]);
  if (!s) notFound();
  const { t } = await getT();
  const S = t.suppliers;
  const KIND_LABEL: Record<string, string> = { product: S.products, service: S.services, brand: S.brands, certification: S.certifications };
  const { data: sqs } = can(user.role, "costs.view")
    ? await supabase
        .from("supplier_quotes")
        .select("id, supplier_quote_number, quote_date, currency, total_amount, status, quotations(id, quote_number, title)")
        .eq("supplier_id", id)
        .order("created_at", { ascending: false })
    : { data: null };
  const canWrite = can(user.role, "suppliers.write");
  const grouped = Object.keys(KIND_LABEL).map((k) => ({ kind: k, items: (caps.data ?? []).filter((c) => c.kind === k) }));

  return (
    <>
      <PageHeader
        title={s.display_name}
        description={`${s.supplier_code}${s.legal_name !== s.display_name ? `, ${s.legal_name}` : ""}`}
        actions={
          canWrite ? (
            <Link href={`/suppliers/${id}/edit`} className={buttonVariants({ variant: "secondary" })}>
              <Pencil /> {t.common.edit}
            </Link>
          ) : null
        }
      >
        <Link href="/suppliers" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {S.title}
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHeader title={S.whatTheySupply} description={S.whatTheySupplyHint} />
            <div className="flex flex-col gap-5 px-5 py-4">
              {grouped.map((g) => (
                <div key={g.kind}>
                  <p className="text-sm text-muted">{KIND_LABEL[g.kind]}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.items.length === 0 ? <span className="text-sm text-muted/70">{S.noneListed}</span> : null}
                    {g.items.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2.5 pr-1 text-sm">
                        {c.value}
                        {canWrite ? (
                          <form action={removeCapability.bind(null, id, c.id)}>
                            <button type="submit" className="inline-flex size-5 items-center justify-center rounded-full text-muted hover:bg-line hover:text-fg" aria-label={t.common.remove(c.value)}>
                              <X className="size-3" />
                            </button>
                          </form>
                        ) : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {canWrite ? <CapabilityForm action={addCapability.bind(null, id)} /> : null}
            </div>
          </Panel>

          {sqs ? (
            <Panel>
              <PanelHeader title={S.quotesFromSupplier} description={S.quotesFromSupplierHint} />
              <ul className="divide-y divide-line">
                {sqs.map((x) => {
                  const q = x.quotations as unknown as { id: string; quote_number: string; title: string } | null;
                  return (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium">{S.quoteNo(x.supplier_quote_number)}</p>
                        <p className="text-muted">
                          {q ? (
                            <Link href={`/quotations/${q.id}`} className="hover:underline">
                              {S.forQuote(q.quote_number, q.title)}
                            </Link>
                          ) : (
                            S.notLinked
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={x.status} />
                        <span className="font-medium tabular-nums">{formatMoney(x.total_amount, x.currency, t.localeTag)}</span>
                      </div>
                    </li>
                  );
                })}
                {!sqs.length ? <li className="px-5 py-4 text-sm text-muted">{S.noQuotes}</li> : null}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader title={t.customers.contacts} />
            <ul className="divide-y divide-line">
              {(contacts.data ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {p.first_name} {p.last_name}
                      {p.is_primary ? <span className="ml-2 text-xs font-normal text-accent">{t.common.primary}</span> : null}
                    </p>
                    <p className="text-muted">{[p.title, p.email, p.phone].filter(Boolean).join(", ") || t.common.noDetails}</p>
                  </div>
                  {canWrite ? (
                    <form action={removeSupplierContact.bind(null, id, p.id)}>
                      <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={t.common.remove(p.first_name)}>
                        <Trash2 />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
              {!contacts.data?.length ? <li className="px-5 py-4 text-sm text-muted">{t.customers.noContacts}</li> : null}
            </ul>
            {canWrite ? (
              <div className="border-t border-line px-5 py-4">
                <AddContactForm action={addSupplierContact.bind(null, id)} />
              </div>
            ) : null}
          </Panel>
        </div>

        <aside className="flex flex-col gap-6">
          <Panel className="p-5 text-sm">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-2xl font-semibold tracking-[0.1em]">{s.supplier_code}</p>
              <StatusBadge status={s.status} />
            </div>
            <dl className="flex flex-col gap-3">
              {[
                [t.customers.paymentTerms, s.payment_terms],
                [t.common.currency, s.currency],
                [S.territory, s.service_territory],
                [t.common.email, s.email],
                [t.common.phone, s.phone],
                [t.common.website, s.website],
                [S.address, [s.line1, s.city, s.state, s.postal_code, s.country].filter(Boolean).join(", ")],
                [S.warranty, s.warranty_info],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="text-muted">{label}</dt>
                  <dd className="break-words">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {s.performance_notes ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-muted">{S.performanceNotes}</p>
                <p className="mt-1 whitespace-pre-line">{s.performance_notes}</p>
              </div>
            ) : null}
          </Panel>
          <Panel className="p-5 text-sm text-muted">
            {S.metricsLater}
          </Panel>
        </aside>
      </div>
    </>
  );
}
