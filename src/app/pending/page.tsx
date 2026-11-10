import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isInternal } from "@/lib/permissions";
import { signOut } from "@/app/(app)/actions";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/components/shell/language-switch";

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.isActive && isInternal(user.role)) redirect("/");
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-[0.08em]">ANASA</p>
        <LanguageSwitch tone="page" />
      </div>
      <h1 className="mt-2 text-2xl font-semibold">{t.auth.pendingTitle}</h1>
      <p className="mt-3 text-sm text-muted">{t.auth.pendingBody(user.email)}</p>
      <form action={signOut} className="mt-8">
        <button className="text-sm text-accent hover:underline" type="submit">
          {t.common.signOut}
        </button>
      </form>
    </main>
  );
}
