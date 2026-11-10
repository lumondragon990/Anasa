import { LoginForm } from "./login-form";
import { getT } from "@/lib/i18n/server";
import { LanguageSwitch } from "@/components/shell/language-switch";

export async function generateMetadata() {
  const { t } = await getT();
  return { title: t.auth.signIn };
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const { t } = await getT();
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-rail p-12 text-rail-fg lg:flex">
        <p className="text-sm font-semibold tracking-[0.08em]">ANASA</p>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight">{t.auth.heroLine}</p>
          <div className="mt-10 flex flex-col gap-3 text-sm text-rail-muted">
            <TraceRow label={t.auth.traceRequest} value="ANA-REQ-2026-00001" />
            <TraceRow label={t.auth.traceQuote} value="ANA-ABC-Q-2026-0001  Rev 02" />
            <TraceRow label={t.auth.tracePo} value="ABC-PO-45872" />
            <TraceRow label={t.auth.traceOrder} value="ANA-ABC-P-2026-0001" accent />
          </div>
        </div>
        <p className="text-xs text-rail-muted">{t.auth.authorizedOnly}</p>
      </section>
      <section className="relative flex items-center justify-center px-6 py-16">
        <div className="absolute right-6 top-6">
          <LanguageSwitch tone="page" />
        </div>
        <div className="w-full max-w-sm">
          <p className="text-sm font-semibold tracking-[0.08em] lg:hidden">ANASA</p>
          <h1 className="mt-2 text-2xl font-semibold">{t.auth.signInTitle}</h1>
          <p className="mb-8 mt-1 text-sm text-muted">{t.auth.signInSub}</p>
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}

function TraceRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-4 border-l border-rail-line pl-4">
      <span className="w-36 shrink-0">{label}</span>
      <span className={accent ? "font-medium text-rail-fg" : "text-rail-fg/80"}>{value}</span>
    </div>
  );
}
