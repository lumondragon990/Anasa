import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/panel";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CustomerForm } from "../customer-form";
import { createCustomer } from "../actions";

export const metadata = { title: "New customer" };

export default async function NewCustomerPage() {
  const user = await requireInternalUser();
  if (!can(user.role, "customers.write")) redirect("/customers");
  return (
    <>
      <PageHeader
        title="New customer"
        description="The customer code identifies this company on every quotation and order number. Codes are permanent: once issued, a code is never given to another company."
      >
        <Link href="/customers" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          Customers
        </Link>
      </PageHeader>
      <Panel className="p-5 sm:p-6">
        <CustomerForm action={createCustomer} isNew submitLabel="Create customer" />
      </Panel>
    </>
  );
}
