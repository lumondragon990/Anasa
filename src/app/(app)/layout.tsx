import { Sidebar } from "@/components/shell/sidebar";
import { requireInternalUser } from "@/lib/auth";
import { ROLE_LABELS, can } from "@/lib/permissions";
import { signOut } from "./actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireInternalUser();
  return (
    <div className="lg:flex">
      <Sidebar
        userName={user.fullName ?? user.email}
        roleLabel={ROLE_LABELS[user.role]}
        isAdmin={can(user.role, "users.manage")}
        signOut={signOut}
      />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-[1280px]">{children}</div>
      </main>
    </div>
  );
}
