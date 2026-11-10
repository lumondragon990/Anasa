"use client";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg py-16">
      <h1 className="text-xl font-semibold">Something went wrong loading this page</h1>
      <p className="mt-2 text-sm text-muted">{error.message || "Unexpected error."}</p>
      {error.digest ? <p className="mt-1 text-xs text-muted">Reference: {error.digest}</p> : null}
      <button onClick={reset} className="mt-6 text-sm text-accent hover:underline">
        Try again
      </button>
    </div>
  );
}
