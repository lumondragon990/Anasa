import { Sidebar } from "@/components/shell/sidebar";
import { requireInternalUser } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { getT } from "@/lib/i18n/server";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInternalUser();
  const { t } = await getT();
  return (
    <div className="lg:flex">
      <Sidebar
        userName={user.fullName ?? user.email}
        roleLabel={t.roles[user.role]}
        isAdmin={can(user.role, "users.manage")}
        signOut={signOut}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
