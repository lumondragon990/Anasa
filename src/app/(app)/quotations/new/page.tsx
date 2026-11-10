import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, Panel, EmptyState } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { NewQuotationForm } from "./new-quotation-form";

export const metadata = { title: "New quotation" };

export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const user = await requireInternalUser();
  if (!can(user.role, "quotes.create")) redirect("/quotations");
  const { customer } = await searchParams;
  const supabase = await createClient();
  const [{ data: customers }, { data: year }] = await Promise.all([
    supabase.from("customers").select("id, customer_code, display_name").neq("status", "inactive").order("display_name"),
    supabase.rpc("business_year"),
  ]);

  return (
    <>
      <PageHeader title="New quotation" description="Starts as Rev 00 in draft. Add lines, then send it for approval.">
        <Link href="/quotations" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          Quotations
        </Link>
      </PageHeader>
      <Panel className="max-w-3xl p-5 sm:p-6">
        {customers && customers.length ? (
          <NewQuotationForm customers={customers} preselected={customer} year={(year as number) ?? new Date().getFullYear()} canSetNumber={can(user.role, "quotes.approve")} />
        ) : (
          <EmptyState title="Add a customer first">
            Every quotation number carries the customer’s code.
            <div className="mt-4">
              <Link href="/customers/new" className={buttonVariants()}>
                New customer
              </Link>
            </div>
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
