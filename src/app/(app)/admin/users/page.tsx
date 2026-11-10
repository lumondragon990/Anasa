import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getT } from "@/lib/i18n/server";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { saveSettings, setUserRole } from "./actions";
import { RoleForm, SettingsForm } from "./forms";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.admin.title };
}

export default async function AdminUsersPage() {
  const user = await requireInternalUser();
  if (!can(user.role, "users.manage")) redirect("/");
  const { t } = await getT();
  const A = t.admin;
  const L = t.localeTag;
  const supabase = await createClient();
  const [{ data: profiles }, { data: settings }, { data: audit }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("application_settings").select("key, value"),
    supabase.from("audit_logs").select("id, table_name, action, at, actor_id").order("at", { ascending: false }).limit(15),
  ]);
  const setting = (k: string) => settings?.find((s) => s.key === k)?.value;
  const pending = profiles?.filter((p) => p.role === "pending").length ?? 0;
  const names = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? p.email]));

  return (
    <>
      <PageHeader
        title={A.title}
        description={A.description}
      />

      <Panel>
        <PanelHeader title={A.users} description={pending ? A.waiting(pending) : A.accounts(profiles?.length ?? 0)} />
        <Table>
          <thead>
            <tr>
              <Th>{A.person}</Th>
              <Th>{A.joined}</Th>
              <Th>{A.roleAccess}</Th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <Tr key={p.id}>
                <Td>
                  <p className="font-medium">
                    {p.full_name ?? p.email}
                    {p.role === "pending" ? <Badge tone="warn" className="ml-2">{A.needsRole}</Badge> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {p.email}, {t.roles[p.role]}
                  </p>
                </Td>
                <Td className="text-muted">{formatDate(p.created_at, L)}</Td>
                <Td>
                  <RoleForm action={setUserRole.bind(null, p.id)} role={p.role} active={p.is_active} isSelf={p.id === user.id} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title={A.settings} />
        <div className="px-5 py-5">
          <SettingsForm
            action={saveSettings}
            timezone={(setting("business_timezone") as string) ?? "America/Chicago"}
            selfApproval={(setting("allow_self_approval") as boolean) ?? true}
          />
        </div>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title={A.audit} description={A.auditHint} />
        <Table>
          <thead>
            <tr>
              <Th>{A.when}</Th>
              <Th>{A.record}</Th>
              <Th>{A.change}</Th>
              <Th>{A.by}</Th>
            </tr>
          </thead>
          <tbody>
            {(audit ?? []).map((a) => (
              <Tr key={a.id}>
                <Td className="text-muted">{new Date(a.at).toLocaleString(L)}</Td>
                <Td>{A.tables[a.table_name] ?? a.table_name.replace(/_/g, " ")}</Td>
                <Td>{A.action[a.action] ?? a.action}</Td>
                <Td className="text-muted">{a.actor_id ? (names.get(a.actor_id) ?? A.unknown) : A.system}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
