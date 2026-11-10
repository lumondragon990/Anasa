import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireInternalUser } from "@/lib/auth";
import { can, ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { PageHeader, Panel, PanelHeader } from "@/components/ui/panel";
import { Badge } from "@/components/ui/badge";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import { saveSettings, setUserRole } from "./actions";
import { RoleForm, SettingsForm } from "./forms";

export const metadata = { title: "Administration" };

export default async function AdminUsersPage() {
  const user = await requireInternalUser();
  if (!can(user.role, "users.manage")) redirect("/");
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
        title="Administration"
        description="New sign-ups have no access until you give them a role. Database policies enforce every role, whatever the screen shows."
      />

      <Panel>
        <PanelHeader title="Users" description={pending ? `${pending} waiting for a role` : `${profiles?.length ?? 0} accounts`} />
        <Table>
          <thead>
            <tr>
              <Th>Person</Th>
              <Th>Joined</Th>
              <Th>Role and access</Th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => (
              <Tr key={p.id}>
                <Td>
                  <p className="font-medium">
                    {p.full_name ?? p.email}
                    {p.role === "pending" ? <Badge tone="warn" className="ml-2">Needs role</Badge> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {p.email}, {ROLE_LABELS[p.role as AppRole]}
                  </p>
                </Td>
                <Td className="text-muted">{formatDate(p.created_at)}</Td>
                <Td>
                  <RoleForm action={setUserRole.bind(null, p.id)} role={p.role} active={p.is_active} isSelf={p.id === user.id} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title="Settings" />
        <div className="px-5 py-5">
          <SettingsForm
            action={saveSettings}
            timezone={(setting("business_timezone") as string) ?? "America/Chicago"}
            selfApproval={(setting("allow_self_approval") as boolean) ?? true}
          />
        </div>
      </Panel>

      <Panel className="mt-6">
        <PanelHeader title="Recent audit activity" description="Every change to customers, suppliers, quotations, orders, users and settings is logged." />
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Record</Th>
              <Th>Change</Th>
              <Th>By</Th>
            </tr>
          </thead>
          <tbody>
            {(audit ?? []).map((a) => (
              <Tr key={a.id}>
                <Td className="text-muted">{new Date(a.at).toLocaleString("en-US")}</Td>
                <Td>{a.table_name.replace(/_/g, " ")}</Td>
                <Td className="capitalize">{a.action.toLowerCase()}</Td>
                <Td className="text-muted">{a.actor_id ? (names.get(a.actor_id) ?? "Unknown") : "System"}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </>
  );
}
