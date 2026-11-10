"use client";

import { useT } from "@/lib/i18n/client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-xl font-semibold">{t.errors.pageError}</h1>
      <p className="mt-2 text-sm text-muted">{error.message || t.errors.unexpected}</p>
      {error.digest ? (
        <p className="mt-1 text-xs text-muted">
          {t.errors.reference}: {error.digest}
        </p>
      ) : null}
      <button onClick={reset} className="mt-6 text-sm text-accent hover:underline">
        {t.common.tryAgain}
      </button>
    </div>
  );
}
