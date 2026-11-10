import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CustomerForm } from "../../customer-form";
import { updateCustomer } from "../../actions";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireInternalUser();
  if (!can(user.role, "customers.write")) redirect(`/customers/${id}`);
  const supabase = await createClient();
  const { data: customer } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
  if (!customer) notFound();

  return (
    <>
      <PageHeader title={`Edit ${customer.display_name}`} description={`Customer code ${customer.customer_code} is changed from the customer page.`}>
        <Link href={`/customers/${id}`} className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {customer.display_name}
        </Link>
      </PageHeader>
      <Panel className="p-5 sm:p-6">
        <CustomerForm action={updateCustomer.bind(null, id)} values={customer} submitLabel="Save changes" />
      </Panel>
    </>
  );
}
