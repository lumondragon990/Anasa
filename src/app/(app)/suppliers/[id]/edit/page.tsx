import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader, Panel } from "@/components/ui/panel";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { SupplierForm } from "../../supplier-form";
import { updateSupplier } from "../../actions";
import { getT } from "@/lib/i18n/server";

export default async function EditSupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireInternalUser();
  if (!can(user.role, "suppliers.write")) redirect(`/suppliers/${id}`);
  const supabase = await createClient();
  const { data: s } = await supabase.from("suppliers").select("*").eq("id", id).maybeSingle();
  if (!s) notFound();
  const { t } = await getT();
  return (
    <>
      <PageHeader title={t.customers.editTitle(s.display_name)}>
        <Link href={`/suppliers/${id}`} className="mb-2 inline-block text-sm text-muted hover:text-fg">
          {s.display_name}
        </Link>
      </PageHeader>
      <Panel className="p-5 sm:p-6">
        <SupplierForm action={updateSupplier.bind(null, id)} values={s} submitLabel={t.common.saveChanges} />
      </Panel>
    </>
  );
}
