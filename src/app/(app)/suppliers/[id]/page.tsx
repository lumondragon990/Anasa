import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { AddContactForm } from "@/app/(app)/customers/[id]/detail-forms";
import { addCapability, addSupplierContact, removeCapability, removeSupplierContact } from "../actions";
import { CapabilityForm } from "./capability-form";

const KIND_LABEL: Record<string, string> = { product: "Products", service: "Services", brand: "Brands", certification: "Certifications" };

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
              <Pencil /> Edit
            </Link>
          ) : null
        }
      >
        <Link href="/suppliers" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          Suppliers
        </Link>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel>
            <PanelHeader title="What they supply" description="Used to find this supplier when sending RFQs" />
            <div className="flex flex-col gap-5 px-5 py-4">
              {grouped.map((g) => (
                <div key={g.kind}>
                  <p className="text-sm text-muted">{KIND_LABEL[g.kind]}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {g.items.length === 0 ? <span className="text-sm text-muted/70">None listed</span> : null}
                    {g.items.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2.5 pr-1 text-sm">
                        {c.value}
                        {canWrite ? (
                          <form action={removeCapability.bind(null, id, c.id)}>
                            <button type="submit" className="inline-flex size-5 items-center justify-center rounded-full text-muted hover:bg-line hover:text-fg" aria-label={`Remove ${c.value}`}>
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

          <Panel>
            <PanelHeader title="Contacts" />
            <ul className="divide-y divide-line">
              {(contacts.data ?? []).map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {p.first_name} {p.last_name}
                      {p.is_primary ? <span className="ml-2 text-xs font-normal text-accent">Primary</span> : null}
                    </p>
                    <p className="text-muted">{[p.title, p.email, p.phone].filter(Boolean).join(", ") || "No details"}</p>
                  </div>
                  {canWrite ? (
                    <form action={removeSupplierContact.bind(null, id, p.id)}>
                      <button type="submit" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={`Remove ${p.first_name}`}>
                        <Trash2 />
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
              {!contacts.data?.length ? <li className="px-5 py-4 text-sm text-muted">No contacts yet.</li> : null}
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
                ["Payment terms", s.payment_terms],
                ["Currency", s.currency],
                ["Territory", s.service_territory],
                ["Email", s.email],
                ["Phone", s.phone],
                ["Website", s.website],
                ["Address", [s.line1, s.city, s.state, s.postal_code, s.country].filter(Boolean).join(", ")],
                ["Warranty", s.warranty_info],
              ].map(([label, value]) => (
                <div key={label} className="grid grid-cols-[6.5rem_1fr] gap-2">
                  <dt className="text-muted">{label}</dt>
                  <dd className="break-words">{value || "—"}</dd>
                </div>
              ))}
            </dl>
            {s.performance_notes ? (
              <div className="mt-4 border-t border-line pt-4">
                <p className="text-muted">Performance notes</p>
                <p className="mt-1 whitespace-pre-line">{s.performance_notes}</p>
              </div>
            ) : null}
          </Panel>
          <Panel className="p-5 text-sm text-muted">
            Response times, on-time delivery and quality metrics are calculated from RFQs and purchase orders once
            those modules ship (phases 4 and 7).
          </Panel>
        </aside>
      </div>
    </>
  );
}
