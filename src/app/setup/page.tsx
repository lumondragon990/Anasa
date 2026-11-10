import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/login");
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-[0.08em]">ANASA</p>
      <h1 className="mt-2 text-2xl font-semibold">Connect a Supabase project to continue</h1>
      <p className="mt-3 text-sm text-muted">
        The app is running, but it has no database connection yet. Add these environment variables, then redeploy
        (Vercel) or restart <code>npm run dev</code> (local):
      </p>
      <pre className="mt-4 overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-surface p-4 text-sm">
{`NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon or publishable key>
NEXT_PUBLIC_SITE_URL=https://<your-app>.vercel.app`}
      </pre>
      <p className="mt-4 text-sm text-muted">
        Both values are in the Supabase dashboard under Project Settings → API. See README.md for the full setup.
      </p>
    </main>
  );
}
