import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/panel";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { CustomerForm } from "../customer-form";
import { createCustomer } from "../actions";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.customers.newCustomer };
}

export default async function NewCustomerPage() {
  const user = await requireInternalUser();
  if (!can(user.role, "customers.write")) redirect("/customers");
  const { t } = await getT();
  return (
    <>
      <PageHeader
        title={t.customers.newCustomer}
        description={t.customers.newDescription}
      >
        <Link href="/customers" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {t.customers.title}
        </Link>
      </PageHeader>
      <Panel className="p-5 sm:p-6">
        <CustomerForm action={createCustomer} isNew submitLabel={t.customers.create} />
      </Panel>
    </>
  );
}
