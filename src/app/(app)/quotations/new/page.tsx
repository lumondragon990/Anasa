import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader, Panel, EmptyState } from "@/components/ui/panel";
import { buttonVariants } from "@/components/ui/button";
import { NewQuotationForm } from "./new-quotation-form";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.quotes.newQuotation };
}

export default async function NewQuotationPage({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const user = await requireInternalUser();
  if (!can(user.role, "quotes.create")) redirect("/quotations");
  const { customer } = await searchParams;
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: customers }, { data: year }] = await Promise.all([
    supabase.from("customers").select("id, customer_code, display_name").neq("status", "inactive").order("display_name"),
    supabase.rpc("business_year"),
  ]);

  return (
    <>
      <PageHeader title={t.quotes.newQuotation} description={t.quotes.newDescription}>
        <Link href="/quotations" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {t.quotes.title}
        </Link>
      </PageHeader>
      <Panel className="max-w-3xl p-5 sm:p-6">
        {customers && customers.length ? (
          <NewQuotationForm customers={customers} preselected={customer} year={(year as number) ?? new Date().getFullYear()} canSetNumber={can(user.role, "quotes.approve")} />
        ) : (
          <EmptyState title={t.quotes.addCustomerFirst}>
            {t.quotes.addCustomerFirstBody}
            <div className="mt-4">
              <Link href="/customers/new" className={buttonVariants()}>
                {t.customers.newCustomer}
              </Link>
            </div>
          </EmptyState>
        )}
      </Panel>
    </>
  );
}
