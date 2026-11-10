import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-rail p-12 text-rail-fg lg:flex">
        <p className="text-sm font-semibold tracking-[0.08em]">ANASA</p>
        <div className="max-w-md">
          <p className="text-3xl font-semibold leading-tight">
            One record from the customer’s first request to the final invoice.
          </p>
          <div className="mt-10 flex flex-col gap-3 text-sm text-rail-muted">
            <TraceRow label="Customer request" value="ANA-REQ-2026-00001" />
            <TraceRow label="Quotation" value="ANA-ABC-Q-2026-0001  Rev 02" />
            <TraceRow label="Customer PO" value="ABC-PO-45872" />
            <TraceRow label="Sales order" value="ANA-ABC-P-2026-0001" accent />
          </div>
        </div>
        <p className="text-xs text-rail-muted">Authorized ANASA personnel only.</p>
      </section>
      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <p className="text-sm font-semibold tracking-[0.08em] lg:hidden">ANASA</p>
          <h1 className="mt-2 text-2xl font-semibold">Sign in to Command Center</h1>
          <p className="mb-8 mt-1 text-sm text-muted">Use your ANASA work account.</p>
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  );
}

function TraceRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center gap-4 border-l border-rail-line pl-4">
      <span className="w-32 shrink-0">{label}</span>
      <span className={accent ? "font-medium text-rail-fg" : "text-rail-fg/80"}>{value}</span>
    </div>
  );
}
