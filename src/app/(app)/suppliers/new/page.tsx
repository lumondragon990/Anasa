import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/panel";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SupplierForm } from "../supplier-form";
import { createSupplier } from "../actions";

export const metadata = { title: "New supplier" };

export default async function NewSupplierPage() {
  const user = await requireInternalUser();
  if (!can(user.role, "suppliers.write")) redirect("/suppliers");
  return (
    <>
      <PageHeader title="New supplier" description="Add products, services and brands on the next screen so the supplier shows up in searches.">
        <Link href="/suppliers" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          Suppliers
        </Link>
      </PageHeader>
      <Panel className="p-5 sm:p-6">
        <SupplierForm action={createSupplier} submitLabel="Create supplier" />
      </Panel>
    </>
  );
}
