import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/components/shell/language-switch";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (isSupabaseConfigured()) redirect("/login");
  const { t } = await getT();
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold tracking-[0.08em]">ANASA</p>
        <LanguageSwitch tone="page" />
      </div>
      <h1 className="mt-2 text-2xl font-semibold">{t.auth.setupTitle}</h1>
      <p className="mt-3 text-sm text-muted">{t.auth.setupBody}</p>
      <pre className="mt-4 overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-surface p-4 text-sm">
{`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app`}
      </pre>
      <p className="mt-4 text-sm text-muted">{t.auth.setupHint}</p>
    </main>
  );
}
