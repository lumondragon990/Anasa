import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">This record doesn’t exist or you can’t see it</h1>
      <p className="mt-2 text-sm text-muted">Check the number or link. Records outside your role are hidden.</p>
      <Link href="/" className="mt-6 text-sm text-accent hover:underline">
        Back to the dashboard
      </Link>
    </main>
  );
}
