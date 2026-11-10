import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/panel";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SupplierForm } from "../supplier-form";
import { createSupplier } from "../actions";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.suppliers.newSupplier };
}

export default async function NewSupplierPage() {
  const user = await requireInternalUser();
  if (!can(user.role, "suppliers.write")) redirect("/suppliers");
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t.suppliers.newSupplier} description={t.suppliers.newDescription}>
        <Link href="/suppliers" className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {t.suppliers.title}
        </Link>
      </PageHeader>
      <Panel className="p-5 sm:p-6">
        <SupplierForm action={createSupplier} submitLabel={t.suppliers.create} />
      </Panel>
    </>
  );
}
